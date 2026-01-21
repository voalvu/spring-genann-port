import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms'; // <--- 1. IMPORT THIS

import { App } from './app';
//import { PolygonCanvas } from './polygon-canvas/polygon-canvas';
import { PuzzleSolver } from './puzzle-solver/puzzle-solver';
import { SpriteViewer } from './sprite-viewer/sprite-viewer';

@NgModule({
  declarations: [
    App,
  //  PolygonCanvas,
    PuzzleSolver,
    SpriteViewer
  ],
  imports: [
    BrowserModule,
    HttpClientModule,
    FormsModule // <--- 2. ADD THIS
  ],
  providers: [],
  bootstrap: [App]
})
export class AppModule { }