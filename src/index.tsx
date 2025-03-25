/** @jsxImportSource preact */
/// <reference types="systemjs" />

import { render } from 'preact/compat';
import { App } from "./app";
import type { BasePlugin } from 'blinko';
import plugin from '../plugin.json';
import en from './locales/en.json';
import zh from './locales/zh.json';
import { LocationCardRender } from './locationRender';
import { Note } from 'blinko/dist/types/src/server/types';

/**
 * Main plugin entry point registered with SystemJS
 * Exports the plugin class implementing BasePlugin interface
 */
System.register([], (exports) => ({
  execute: () => {
    exports('default', class Plugin implements BasePlugin {
      constructor() {
        // Initialize plugin with metadata from plugin.json
        Object.assign(this, plugin);
      }
      async init() {
        this.initI18n();
        window.Blinko.addToolBarIcon({
          name: "location",
          icon: "mynaui:location",
          placement: 'top',
          tooltip: window.Blinko.i18n.t('location'),
          content: (mode: any) => {

            const container = document.createElement('div');
            container.setAttribute('data-plugin', 'my-note-plugin');
            render(<App />, container);
            return container;
          }
        });

        window.Blinko.addCardFooterSlot({
          name: 'location',
          content: (note: Note) => {
            const container = document.createElement('div');
            container.setAttribute('data-plugin', 'my-note-plugin');
            render(<LocationCardRender locationInfo={note.metadata} note={note} />, container);
            return container;
          }
        })
      }
      initI18n() {
        window.Blinko.i18n.addResourceBundle('en', 'translation', en);
        window.Blinko.i18n.addResourceBundle('zh', 'translation', zh);
      }
      destroy() {
        console.log('Plugin destroyed');
      }
    });
  }
}));