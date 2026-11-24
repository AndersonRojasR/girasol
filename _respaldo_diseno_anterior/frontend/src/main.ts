import { bootstrapApplication } from '@angular/platform-browser';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { AppComponent } from './app/app.component';

bootstrapApplication(AppComponent, {
  providers: [
    provideHttpClient(),
    provideRouter([
      { path: '', loadComponent: () => import('./app/features/girasol/girasol.component').then(m => m.GirasolComponent) },
      { path: 'dashboard', loadComponent: () => import('./app/features/dashboard/dashboard.component').then(m => m.DashboardComponent) },
      { path: 'panel', loadComponent: () => import('./app/features/motor/travel.component').then(m => m.TravelComponent) },
      { path: 'sensores', loadComponent: () => import('./app/features/sensores/sensores.component').then(m => m.SensoresComponent) },
      { path: 'settings', loadComponent: () => import('./app/features/settings/settings.component').then(m => m.SettingsComponent) },
      { path: 'motor', loadComponent: () => import('./app/features/motor/travel.component').then(m => m.TravelComponent) },
      { path: 'motores', loadComponent: () => import('./app/features/motor/motor.component').then(m => m.MotorComponent) },
      { path: 'historial', loadComponent: () => import('./app/features/historial/historial.component').then(m => m.HistorialComponent) },
      { path: '**', redirectTo: '' }
    ])
  ]
}).catch(console.error);
