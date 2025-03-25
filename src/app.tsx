import { useState, useEffect, useRef } from 'preact/hooks';
import type { JSXInternal } from 'preact/src/jsx';
import type { CSSProperties } from 'preact/compat';
import 'ol/ol.css';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import XYZ from 'ol/source/XYZ';
import { fromLonLat, toLonLat } from 'ol/proj';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import { Vector as VectorLayer } from 'ol/layer';
import { Vector as VectorSource } from 'ol/source';
import { Style, Circle, Fill, Stroke } from 'ol/style';
import { defaults as defaultControls } from 'ol/control';
import ZoomControl from 'ol/control/Zoom';
import { render } from 'preact';
import { LocationRender } from './locationRender';

// Define the location type
interface Location {
  lat: number;
  lng: number;
}

// Place information interface
interface PlaceInfo {
  name: string;
  lat: number;
  lng: number;
}


export function App({ onClick, style }: { onClick?: (locationInfo: PlaceInfo | null) => void, style?: CSSProperties }): JSXInternal.Element {
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [locationName, setLocationName] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingPlaceName, setLoadingPlaceName] = useState<boolean>(false);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const markerLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const markerSourceRef = useRef<VectorSource | null>(null);
  const i18n = window.Blinko.i18n;

  // Set marker style
  const getMarkerStyle = () => {
    return new Style({
      image: new Circle({
        radius: 8,
        fill: new Fill({
          color: '#FF4D4F'
        }),
        stroke: new Stroke({
          color: '#FFFFFF',
          width: 2
        })
      })
    });
  };

  // Add marker at specified coordinates
  const addMarkerAt = (coordinate: number[], map: Map, source: VectorSource) => {
    // Clear existing markers
    source.clear();

    // Create new marker
    const marker = new Feature({
      geometry: new Point(coordinate)
    });

    // Set marker style
    marker.setStyle(getMarkerStyle());

    // Add to layer
    source.addFeature(marker);

    // Return coordinates
    const lonLat = toLonLat(coordinate);
    return {
      lng: lonLat[0],
      lat: lonLat[1]
    };
  };

  // Try to get user's current location
  const getCurrentLocation = () => {
    return new Promise<GeolocationPosition>((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error(i18n.t('map.browserNotSupport')));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => resolve(position),
        (error) => reject(error),
        { timeout: 10000, enableHighAccuracy: true }
      );
    });
  };

  // Get place name from coordinates using reverse geocoding
  const getPlaceNameFromCoords = async (lat: number, lng: number): Promise<string> => {
    try {
      setLoadingPlaceName(true);
      // Get browser language or fall back to 'en' if not available
      const browserLang = navigator.language || navigator.languages?.[0] || 'en';
      // Format Accept-Language header with browser language as primary and English as fallback
      const acceptLanguage = `${browserLang},en-US;q=0.8,en;q=0.5`;
      
      // Use OpenStreetMap's Nominatim service for reverse geocoding (no token needed)
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
        {
          headers: {
            'Accept-Language': acceptLanguage, // Use browser language
            'User-Agent': 'Blinko-Map-App' // Must provide user agent
          }
        }
      );

      if (!response.ok) {
        throw new Error(i18n.t('map.cannotGetLocation'));
      }

      const data = await response.json();

      // Build place name from response data
      let placeName = '';

      if (data.address) {
        const addr = data.address;

        // Organize address by administrative regions
        const province = addr.state || addr.province;
        const city = addr.city;
        const district = addr.district || addr.county || addr.city_district;
        const road = addr.road || addr.street;
        const houseNumber = addr.house_number;

        // Get browser language for formatting
        const userLang = navigator.language || navigator.languages?.[0] || 'en';
        
        // Combine address parts
        const parts = [];

        if (province) parts.push(province);
        if (city && city !== province) parts.push(city);
        if (district && district !== city) parts.push(district);
        
        // Format road and house number based on language/locale
        if (road) {
          if (houseNumber) {
            // Different regions use different address formats
            if (userLang.startsWith('zh')) {
              // Chinese format: Road + Number + 号
              parts.push(`${road}${houseNumber}号`);
            } else if (userLang.startsWith('ja') || userLang.startsWith('ko')) {
              // Japanese/Korean similar to Chinese
              parts.push(`${road}${houseNumber}`);
            } else {
              // Western format: Number + Road
              parts.push(`${houseNumber} ${road}`);
            }
          } else {
            parts.push(road);
          }
        }

        if (parts.length > 0) {
          // Join with comma for western languages, space for some Asian languages
          const separator = userLang.startsWith('zh') || userLang.startsWith('ja') || userLang.startsWith('ko') ? ' ' : ', ';
          placeName = parts.join(separator);
        } else {
          // If no valid address parts extracted, use display name
          placeName = data.display_name.split(',')[0];
        }
      } else {
        // Fallback to default name
        placeName = data.display_name
          ? data.display_name.split(',')[0]
          : i18n.t('map.locationPoint', { lat: lat.toFixed(4), lng: lng.toFixed(4) });
      }

      return placeName;
    } catch (error) {
      console.error('Failed to get location name:', error);
      // If failed, return coordinates as name
      return i18n.t('map.locationPoint', { lat: lat.toFixed(4), lng: lng.toFixed(4) });
    } finally {
      setLoadingPlaceName(false);
    }
  };

  // Update selected location and automatically fetch place name
  const updateSelectedLocation = async (location: Location) => {
    setSelectedLocation(location);

    // Automatically get and set place name
    try {
      const placeName = await getPlaceNameFromCoords(location.lat, location.lng);
      setLocationName(placeName);
    } catch (error) {
      console.error('Failed to get location name:', error);
      setLocationName(i18n.t('map.locationPoint', { lat: location.lat.toFixed(4), lng: location.lng.toFixed(4) }));
    }
  };

  // Helper function to add location footer slot with given location info
  const addLocationFooter = (locInfo: PlaceInfo | null) => {
    window.Blinko.addEditorFooterSlot({
      name: 'location',
      content: (mode: any) => {
        const container = document.createElement('div');
        container.setAttribute('data-plugin', 'my-note-plugin');
        render(<LocationRender locationInfo={locInfo} />, container);
        return container;
      }
    });
  };


  // Save location information
  const saveLocation = () => {
    if (selectedLocation) {
      let locationInfo: PlaceInfo = {
        name: locationName || i18n.t('map.unnamed'),
        lat: selectedLocation.lat,
        lng: selectedLocation.lng
      };
      if (onClick) {
        onClick(locationInfo);
        return;
      }
      console.log(i18n.t('map.saveLocation') + ':', locationInfo);
      window.Blinko.closeToolBarContent('location');
      window.Blinko.setEditorMetadata(locationInfo);


      // Add initial footer with location info
      addLocationFooter(locationInfo);

      // Set up event listener to update footer after note is saved
      window.Blinko.eventBus.once('upsertNote', () => {
        addLocationFooter(null);
      });
    }
  };

  useEffect(() => {
    if (mapContainerRef.current && !mapRef.current) {
      setLoading(true);

      // Create vector source and layer
      const markerSource = new VectorSource();
      markerSourceRef.current = markerSource;

      // Create marker layer
      const markerLayer = new VectorLayer({
        source: markerSource,
        style: getMarkerStyle(),
        zIndex: 999
      });
      markerLayerRef.current = markerLayer;

      // Use Gaode Map tiles
      const tileLayer = new TileLayer({
        source: new XYZ({
          url: 'https://wprd01.is.autonavi.com/appmaptile?lang=zh_cn&size=1&style=7&x={x}&y={y}&z={z}',
          tileSize: 256,
          maxZoom: 18
        })
      });

      // Create map
      const map = new Map({
        target: mapContainerRef.current,
        layers: [tileLayer, markerLayer],
        controls: defaultControls({
          zoom: false,
          rotate: false
        }).extend([
          new ZoomControl({
            className: 'custom-zoom'
          })
        ]),
        view: new View({
          center: fromLonLat([116.4074, 39.9042]), // Default: Beijing
          zoom: 13
        })
      });

      mapRef.current = map;

      // Try to get current location
      getCurrentLocation()
        .then((position) => {
          const { longitude, latitude } = position.coords;

          // Center map on current location
          map.getView().setCenter(fromLonLat([longitude, latitude]));

          // Add marker at current location
          const location = addMarkerAt(
            fromLonLat([longitude, latitude]),
            map,
            markerSource
          );

          // Update selected location and get place name
          updateSelectedLocation(location);
          console.log('Current location:', location);
        })
        .catch((error) => {
          console.warn('Unable to get current location:', error.message);
          // Use default location (Beijing)
          const defaultLocation = { lng: 116.4074, lat: 39.9042 };
          const coordinate = fromLonLat([defaultLocation.lng, defaultLocation.lat]);
          addMarkerAt(coordinate, map, markerSource);
          updateSelectedLocation(defaultLocation);
        })
        .finally(() => {
          setLoading(false);
        });

      // Add click event
      map.on('click', (evt) => {
        // Add marker and get coordinates
        const location = addMarkerAt(evt.coordinate, map, markerSource);

        // Update selected location and get place name
        updateSelectedLocation(location);
        console.log('Selected location:', location);

      });
    }

    // Cleanup
    return () => {
      if (mapRef.current) {
        mapRef.current.setTarget(undefined);
        mapRef.current = null;
      }
    };
  }, []);

  return (
    <div style={{ width: '300px', height: '250px', display: 'flex', flexDirection: 'column', ...style }}>
      <div
        ref={mapContainerRef}
        style={{
          flex: 1,
          borderRadius: '8px',
          position: 'relative',
          overflow: 'hidden',
          cursor: 'pointer'
        }}
      >
        {loading && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000
          }}>
            <div>{i18n.t('map.loading')}</div>
          </div>
        )}
      </div>

      {selectedLocation && (
        <div style={{
          padding: '12px 16px',
          position: 'relative'
        }}>
          <div style={{
            fontSize: '14px',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            paddingRight: '140px'
          }}>
            {locationName}
            {loadingPlaceName && <span style={{ marginLeft: '5px', fontSize: '12px', opacity: 0.7 }}>{i18n.t('map.gettingLocation')}</span>}
          </div>

          <div style={{
            position: 'absolute',
            right: '12px',
            top: '50%',
            transform: 'translateY(-50%)',
            display: 'flex',
            gap: '8px'
          }}>
            <button
              onClick={() => {
                setSelectedLocation(null);
                setLocationName('');
                if (markerSourceRef.current) {
                  markerSourceRef.current.clear();
                }
                if (onClick) {
                  onClick(null);
                } else {
                  addLocationFooter(null);
                  window.Blinko.closeToolBarContent('location');
                }
              }}
              style={{
                border: 'none',
                borderRadius: '4px',
                padding: '5px 12px',
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              {i18n.t('map.clear')}
            </button>

            <button
              onClick={saveLocation}
              className='bg-primary text-primary-foreground'
              style={{
                border: 'none',
                borderRadius: '4px',
                padding: '5px 12px',
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              {i18n.t('map.confirm')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
