import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { HttpClientModule } from '@angular/common/http'; // <--- ADD THIS

import { AppComponent } from './app.component';
import { PolygonCanvas } from './polygon-canvas/polygon-canvas';

@NgModule({
  declarations: [
    AppComponent,
    PolygonCanvas
  ],
  imports: [
    BrowserModule,
    HttpClientModule // <--- ADD THIS
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }