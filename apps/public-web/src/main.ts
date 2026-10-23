import { logBootstrapFailure } from '@mapit/logging';
import { bootstrapApplication } from '@angular/platform-browser';

import { App } from './app/app';
import { appConfig } from './app/app.config';

bootstrapApplication(App, appConfig).catch((err: unknown) => {
  logBootstrapFailure('mapit-public-web', err);
});
