import pakageJson from '../package.json'
import { Monitor } from "./core/Monitor";
import { ConsolePlugin } from "./plugins/ConsolePlugin";
import { RequestPlugin } from "./plugins/RequestPlugin";
import { ResourcePlugin } from "./plugins/ResourcePlugin";
import { ErrorPlugin } from "./plugins/ErrorPlugin";
import { CustomPlugin } from "./plugins/CustomPlugin";
import { WhiteScreenPlugin } from "./plugins/WhiteScreenPlugin";
import { PerformancePlugin } from "./plugins/PerformancePlugin";
import { RecordPlugin } from "./plugins/RecordPlugin";
import type { WebEyeConfig, IPlugin } from "./types";

// Export types
export type { WebEyeConfig, IPlugin };

// Export all plugins
export {
  ConsolePlugin,
  RequestPlugin,
  ResourcePlugin,
  ErrorPlugin,
  CustomPlugin,
  WhiteScreenPlugin,
  PerformancePlugin,
  RecordPlugin,
};

// Export the main Monitor class
export { Monitor };

// Auto-initialize when loaded via script tag
if (typeof window !== 'undefined') {
  const version = pakageJson?.version || '1.0.0'

  window.WebEyeLogs = window.WebEyeLogs || {
    Monitor,
    plugins: {
      ConsolePlugin,
      RequestPlugin,
      ResourcePlugin,
      ErrorPlugin,
      CustomPlugin,
      WhiteScreenPlugin,
      PerformancePlugin,
      RecordPlugin,
    },
    version,
  }

  // Auto-initialize if data-config attribute is present
  document.addEventListener('DOMContentLoaded', () => {
    const script = document.querySelector('script[data-web-eye][data-config]');
    if (script) {
      try {
        const config = JSON.parse(script.getAttribute('data-config') || '{}');
        const monitor = new Monitor(config);
        monitor.install();
      } catch (error) {
        console.error('Failed to initialize WebEyeLogs:', error)
      }
    }
  });
}
