import { bootstrapApplication } from '@angular/platform-browser';

import { App } from './app/app';
import { appConfig } from './app/app.config';

bootstrapApplication(App, appConfig).catch((err: unknown) => {
  console.error('No se pudo arrancar la consola de MapIt', err);
});
