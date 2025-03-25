import { render } from "preact";
import { App } from "./app";
import { Note } from "blinko/dist/types/src/server/types";

// 添加全局CSS样式
const style = document.createElement('style');
style.textContent = `
  @keyframes locationFadeIn {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  @keyframes cardFadeIn {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  .location-card {
    transition: transform 0.2s ease;
  }
  
  .location-card:hover {
    transform: scale(1.03);
  }
  
  .location-card:active {
    transform: scale(0.97);
  }
`;
document.head.appendChild(style);

export function LocationRender({ locationInfo }: { locationInfo: any }) {
  if (!locationInfo?.name) return null;
  return (
    <div 
      className='text-sm text-desc w-fit rounded-md flex gap-1 mb-2 items-center'
      style={{
        animation: 'locationFadeIn 0.3s ease-out forwards',
      }}
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"><path d="M12.56 20.82a.96.96 0 0 1-1.12 0C6.611 17.378 1.486 10.298 6.667 5.182A7.6 7.6 0 0 1 12 3c2 0 3.919.785 5.333 2.181c5.181 5.116.056 12.196-4.773 15.64" /><path d="M12 12a2 2 0 1 0 0-4a2 2 0 0 0 0 4" /></g></svg>
      {locationInfo?.name}
    </div>
  );
}

export function LocationCardRender({ locationInfo, note }: { locationInfo: any, note: Note }) {
  if (!locationInfo?.name) return null;
  
  return (
    <div 
      className='text-sm text-desc w-fit rounded-md flex gap-1 mb-2 items-center cursor-pointer '
      onClick={() => {
        console.log('showDialog');
        window.Blinko.showDialog({
          title: window.Blinko.i18n.t('location'),
          size: 'md',
          content: () => {
            const container = document.createElement('div');
            container.setAttribute('data-plugin', 'my-note-plugin');
            if (locationInfo == null) {
              try {
                delete note.metadata.name;
                delete note.metadata.lat;
                delete note.metadata.lng;
              } catch (error) {
                console.error(error);
              }
            } else {
              try {
                note.metadata.name = locationInfo.name;
                note.metadata.lat = locationInfo.lat;
                note.metadata.lng = locationInfo.lng;
              } catch (error) {
                console.error(error);
              }
            }
            render(<App 
              style={{ width: '100%', height: '400px' }} 
              onClick={async (updatedLocationInfo) => {
                console.log('Location updated:', updatedLocationInfo);
                if (updatedLocationInfo) {
                  try {
                    note.metadata.name = updatedLocationInfo.name;
                    note.metadata.lat = updatedLocationInfo.lat;
                    note.metadata.lng = updatedLocationInfo.lng;
                  } catch (error) {
                    console.error(error);
                  }
                } else {
                  try {
                    note.metadata.name = '';
                    note.metadata.lat = 0;
                    note.metadata.lng = 0;
                  } catch (error) {
                    console.error(error);
                  }
                }
                
                await window.Blinko.api.notes.upsert.mutate({
                  id: note.id,
                  metadata: {
                    ...note.metadata,
                  }
                });
                window.Blinko.closeDialog();
                window.Blinko.store.blinkoStore.updateTicker++
              }} 
            />, container);
            return container;
          }
        });
      }}
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"><path d="M12.56 20.82a.96.96 0 0 1-1.12 0C6.611 17.378 1.486 10.298 6.667 5.182A7.6 7.6 0 0 1 12 3c2 0 3.919.785 5.333 2.181c5.181 5.116.056 12.196-4.773 15.64" /><path d="M12 12a2 2 0 1 0 0-4a2 2 0 0 0 0 4" /></g></svg>
      {locationInfo?.name}
    </div>
  );
}