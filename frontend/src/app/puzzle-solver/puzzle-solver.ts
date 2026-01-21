import { Component, ElementRef, ViewChild, ViewChildren, QueryList, HostListener } from '@angular/core';
import { HttpClient } from '@angular/common/http';
// --- INTERFACES ---
interface VectorCommand {
  type: string; x: number; y: number; cx?: number; cy?: number;
  fillColor?: string; strokeColor?: string; lineWidth?: number;
}
interface SwfShape { charId: number; commands: VectorCommand[]; }
interface SwfInstance { charId: number; depth: number; matrix: number[]; }
interface SwfSprite { spriteId: number; frameCount: number; frames: SwfInstance[][]; }
interface SwfResponse { name: string; shapes: SwfShape[]; sprites: SwfSprite[]; symbolMap: { [key: number]: string };}
interface Point { x: number; y: number; }
interface Bounds { minX: number; maxX: number; minY: number; maxY: number; width: number; height: number; cx: number; cy: number; }
interface ShapeVersion { name: string; commands: VectorCommand[]; }
@Component({
  selector: 'app-puzzle-solver',
  standalone: false,
  templateUrl: './puzzle-solver.html',
  styleUrls: ['./puzzle-solver.css']
})
export class PuzzleSolver {
@ViewChild('mainCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;
@ViewChild('editCanvas') editCanvasRef!: ElementRef<HTMLCanvasElement>;
@ViewChildren('layerPreview') layerPreviews!: QueryList<ElementRef<HTMLCanvasElement>>;
  atlasDrawn = false
  hasImage = false;
  isDragging = false;
  resultUrl: string | null = null;
  importedShapeName: string | null = null;
  swfShapes: SwfShape[] = [];
  swfSprites: SwfSprite[] = [];
  screenHeight: number | null = null;
  screenWidth: number | null = null;
readonly CELL_SIZE = 150;
readonly PADDING = 20;
  showColors = true;
  symbolMap: { [key: number]: string } = {};
//Editing canvas variables
private editCtx!: CanvasRenderingContext2D;
private selectedShape: SwfShape | null = null;
private dragStart: Point | null = null;
private shapeOffset: Point = { x: 0, y: 0 };
public selectedPointIndex: { commandIndex: number, isControl: boolean } | null = null;
private moveMode: 'both' | 'x' | 'y' | null = null;
public selectedX: number = 0;
public selectedY: number = 0;
private zoom: number = 1;
public layers: {commands: VectorCommand[], visible: boolean}[] = [];
private shapeVersions: { [key: number]: { original: VectorCommand[], versions: ShapeVersion[] } } = {};
public currentVersions: ShapeVersion[] = [];
public selectedVersionIndex: number | null = null;

constructor(private http: HttpClient) {
  this.onResize(event);
}
@HostListener('window:resize', ['$event'])
onResize(event?: Event) {
   this.screenHeight = window.innerHeight;
   this.screenWidth = window.innerWidth;
   console.log(this.screenHeight,this.screenWidth)
}
loadFromCache(){
if(localStorage.getItem("cachedSwfShape")!= null){
        this.swfShapes = JSON.parse(localStorage.getItem("cachedSwfShape") ?? "null")
        this.swfSprites = JSON.parse(localStorage.getItem("swfSprites")?? "null")
        this.importedShapeName = JSON.parse(localStorage.getItem("importedShapeName")?? "null")
        this.symbolMap = JSON.parse(localStorage.getItem("symbolMap")?? "null")
        this.drawAtlas();
}
}
// --- API CALL ---
uploadSwf(file: File) {
const formData = new FormData();
    formData.append('file', file);
    this.http.post<SwfResponse>('http://localhost:8080/api/swf/upload', formData).subscribe({
next: (res) => {
        this.importedShapeName = res.name;
        this.swfShapes = res.shapes;
        this.swfSprites = res.sprites;
        this.symbolMap = res.symbolMap || {};
        this.drawAtlas();
        const dragOverlay = document.querySelector(".drag-overlay") as HTMLElement;
        const drophere = document.getElementById("drop-here-annotation");
        dragOverlay ? dragOverlay.style.display = "none" : null;
        drophere ? drophere.style.display = "none" : null;

},
error: (err) => console.error(err)
});
}
drawEditCanvas(){
const cvs = this.editCanvasRef.nativeElement;
const ctx = cvs.getContext('2d')!;
        ctx.fillStyle = "#790505ff";
    ctx.fillRect(0, 0, cvs.width, cvs.height);
    ctx.fillStyle = "white";
const fontSize = 32;
    ctx.font = `${fontSize}px Arial`;
    ctx.fillText("sprite editor",10,10+fontSize)
}
// --- GLOBAL MOUSE EVENTS ---
@HostListener('document:mousemove', ['$event'])
onMouseMove(e: MouseEvent) {
    //console.log(e,this.selectedPointIndex,this.isDragging && this.selectedShape)
if (this.isDragging && this.selectedShape) {
      console.log('mouse moving with shape')
// Dragging the whole shape with middle mouse (button 1)
      console.log(e.buttons)
if (e.buttons === 4) {
        console.log('is 4')
        this.shapeOffset.x += e.movementX;
        this.shapeOffset.y += e.movementY;
        this.updateEditCanvas();
        console.log('updated')
}
// Moving a specific point with left mouse (button 0)
else if (this.selectedPointIndex!== null && e.buttons === 1) {
        console.log('specific point')
const rect = this.editCanvasRef.nativeElement.getBoundingClientRect();
const x = (e.clientX - rect.left - this.shapeOffset.x) / this.zoom;
const y = (e.clientY - rect.top - this.shapeOffset.y) / this.zoom;
const cmdIndex = this.selectedPointIndex.commandIndex;
const cmd = this.selectedShape.commands[cmdIndex];
const isControl = this.selectedPointIndex.isControl;
if (!isControl) {
  if (this.moveMode === 'both' || this.moveMode === 'x') cmd.x = x;
  if (this.moveMode === 'both' || this.moveMode === 'y') cmd.y = y;
} else {
  if (this.moveMode === 'both' || this.moveMode === 'x') cmd.cx = x;
  if (this.moveMode === 'both' || this.moveMode === 'y') cmd.cy = y;
}
this.selectedX = isControl ? cmd.cx! : cmd.x;
this.selectedY = isControl ? cmd.cy! : cmd.y;
        this.updateEditCanvas();
}
}
}
@HostListener('document:mouseup', ['$event'])
onMouseUp(e: MouseEvent) {
    if (this.moveMode !== null && this.selectedVersionIndex !== null) {
      this.selectedVersionIndex = null;
    }
    this.isDragging = false;
    this.dragStart = null;
    this.moveMode = null;
    console.log(this.isDragging,this.dragStart)
}
// --- CANVAS HANDLERS ---
onEditCanvasMouseDown(e: MouseEvent) {
// Middle mouse button (button 1) starts drag of the entire shape
    console.log(e,e.button)
if (e.button === 1) {
      console.log('middled')
      e.preventDefault(); // Prevents auto-scroll
      this.isDragging = true;
      this.dragStart = { x: e.clientX, y: e.clientY };
      console.log(this.isDragging,this.dragStart)
}
// Right mouse button (button 2) attempts to select a point
else if (e.button === 2) {
      e.preventDefault();
      this.isDragging = true; // Set isDragging to allow movement tracking in mousemove
      this.selectPoint(e);
}
// Left mouse button (button 0) for dragging points or handles
else if (e.button === 0) {
      e.preventDefault();
      if (!this.selectedPointIndex || !this.selectedShape) return;
      const rect = this.editCanvasRef.nativeElement.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;
      const cmdIndex = this.selectedPointIndex.commandIndex;
      const cmd = this.selectedShape.commands[cmdIndex];
      const isControl = this.selectedPointIndex.isControl;
      const posX = isControl ? cmd.cx! : cmd.x;
      const posY = isControl ? cmd.cy! : cmd.y;
      const sx = this.shapeOffset.x + posX * this.zoom;
      const sy = this.shapeOffset.y + posY * this.zoom;
      const tol = 10;
      const handleLength = 20;
      if (Math.hypot(clickX - sx, clickY - sy) < tol) {
        this.moveMode = 'both';
        this.isDragging = true;
      } else if (Math.hypot(clickX - (sx + handleLength), clickY - sy) < tol) {
        this.moveMode = 'x';
        this.isDragging = true;
      } else if (Math.hypot(clickX - sx, clickY - (sy + handleLength)) < tol) {
        this.moveMode = 'y';
        this.isDragging = true;
      }
}
}
onWheel(e: WheelEvent) {
  e.preventDefault();
  const rect = this.editCanvasRef.nativeElement.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;
  const oldZoom = this.zoom;
  this.zoom *= (e.deltaY < 0 ? 1.1 : 0.9);
  this.zoom = Math.max(0.1, Math.min(25, this.zoom));
  const dx = mouseX - this.shapeOffset.x;
  const dy = mouseY - this.shapeOffset.y;
  this.shapeOffset.x = mouseX - dx * (this.zoom / oldZoom);
  this.shapeOffset.y = mouseY - dy * (this.zoom / oldZoom);
  this.updateEditCanvas();
}
// --- EDITING LOGIC ---
/**
   * Clears the edit canvas and redraws the selected shape and points.
   */
updateEditCanvas() {
    console.log('updating')
if (!this.selectedShape) return;
const cvs = this.editCanvasRef.nativeElement;
const ctx = this.editCtx;
    console.log(cvs.width,cvs.height)

// Clear canvas
    ctx.fillStyle = "#790505ff";
    ctx.fillRect(0, 0, cvs.width, cvs.height);
    ctx.save();
// Apply the current drag offset and zoom
    ctx.translate(this.shapeOffset.x, this.shapeOffset.y);
    ctx.scale(this.zoom, this.zoom);
// Draw the shape layers that are visible
    this.layers.filter(layer => layer.visible).forEach(layer => {
      this.drawCommands(ctx, layer.commands, this.zoom);
    });
    ctx.restore();
// Draw interactive points in screen space
    this.drawPoints(ctx, this.selectedShape.commands);
    console.log('updated edit')
}
/**
   * Helper to draw control points on the edit canvas.
   */
drawPoints(ctx: CanvasRenderingContext2D, cmds: VectorCommand[]) {
    const handleLength = 20;
    cmds.forEach((cmd, cmdIndex) => {
      if (cmd.type === 'MOVE' || cmd.type === 'LINE' || cmd.type === 'CURVE') {
        const wx = cmd.x;
        const wy = cmd.y;
        const sx = this.shapeOffset.x + wx * this.zoom;
        const sy = this.shapeOffset.y + wy * this.zoom;
        // Draw end points
        ctx.fillStyle = 'rgba(0, 0, 255, 0.7)'; // Blue for standard points
        const isSelected = this.selectedPointIndex && this.selectedPointIndex.commandIndex === cmdIndex && !this.selectedPointIndex.isControl;
        // Highlight selected point in green
        if (isSelected) {
             ctx.fillStyle = 'lime';
             console.log('theres a selected point')
        }
        ctx.beginPath();
        ctx.arc(sx, sy, 5, 0, 2 * Math.PI);
        ctx.fill();
        if (isSelected) {
          // Draw X axis handle (red)
          ctx.strokeStyle = 'red';
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(sx + handleLength, sy);
          ctx.stroke();
          ctx.fillStyle = 'red';
          ctx.beginPath();
          ctx.arc(sx + handleLength, sy, 3, 0, 2 * Math.PI);
          ctx.fill();
          // Draw Y axis handle (blue)
          ctx.strokeStyle = 'blue';
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(sx, sy + handleLength);
          ctx.stroke();
          ctx.fillStyle = 'blue';
          ctx.beginPath();
          ctx.arc(sx, sy + handleLength, 3, 0, 2 * Math.PI);
          ctx.fill();
        }
      }
      // Draw control points
      if (cmd.type === 'CURVE' && cmd.cx !== undefined && cmd.cy !== undefined) {
        const cwx = cmd.cx;
        const cwy = cmd.cy;
        const csx = this.shapeOffset.x + cwx * this.zoom;
        const csy = this.shapeOffset.y + cwy * this.zoom;
        ctx.fillStyle = 'rgba(255, 165, 0, 0.7)'; // Orange for curve handles
        const isSelected = this.selectedPointIndex && this.selectedPointIndex.commandIndex === cmdIndex && this.selectedPointIndex.isControl;
        // Highlight selected control point in green
        if (isSelected) {
             ctx.fillStyle = 'lime';
             console.log('theres a selected point')
        }
        ctx.beginPath();
        ctx.arc(csx, csy, 5, 0, 2 * Math.PI);
        ctx.fill();
        if (isSelected) {
          // Draw X axis handle (red)
          ctx.strokeStyle = 'red';
          ctx.beginPath();
          ctx.moveTo(csx, csy);
          ctx.lineTo(csx + handleLength, csy);
          ctx.stroke();
          ctx.fillStyle = 'red';
          ctx.beginPath();
          ctx.arc(csx + handleLength, csy, 3, 0, 2 * Math.PI);
          ctx.fill();
          // Draw Y axis handle (blue)
          ctx.strokeStyle = 'blue';
          ctx.beginPath();
          ctx.moveTo(csx, csy);
          ctx.lineTo(csx, csy + handleLength);
          ctx.stroke();
          ctx.fillStyle = 'blue';
          ctx.beginPath();
          ctx.arc(csx, csy + handleLength, 3, 0, 2 * Math.PI);
          ctx.fill();
        }
      }
    });
}
/**
   * Logic to determine which point was clicked (right mouse button).
   */
selectPoint(e: MouseEvent) {
if (!this.selectedShape) return;
    console.log('selected point')
const rect = this.editCanvasRef.nativeElement.getBoundingClientRect();
// Calculate click position relative to the shape's local coordinate system (factoring in drag offset)
const clickX = (e.clientX - rect.left - this.shapeOffset.x) / this.zoom;
const clickY = (e.clientY - rect.top - this.shapeOffset.y) / this.zoom;
const clickTolerance = 10 / this.zoom; // Adjust tolerance with zoom
    this.selectedPointIndex = null;
for (let cmdIndex = 0; cmdIndex < this.selectedShape.commands.length; cmdIndex++) {
const cmd = this.selectedShape.commands[cmdIndex];
// Check standard points
if (cmd.type !== 'STYLE') {
if (Math.abs(cmd.x - clickX) < clickTolerance && Math.abs(cmd.y - clickY) < clickTolerance) {
          this.selectedPointIndex = { commandIndex: cmdIndex, isControl: false };
break; // Point found
}
}
// Check control points (cx, cy)
if (cmd.type === 'CURVE' && cmd.cx !== undefined && cmd.cy !== undefined) {
if (Math.abs(cmd.cx - clickX) < clickTolerance && Math.abs(cmd.cy - clickY) < clickTolerance) {
          this.selectedPointIndex = { commandIndex: cmdIndex, isControl: true };
break; // Point found
}
}
}
if (this.selectedPointIndex) {
      console.log("Selected point:", this.selectedPointIndex);
      const cmd = this.selectedShape.commands[this.selectedPointIndex.commandIndex];
      const isControl = this.selectedPointIndex.isControl;
      this.selectedX = isControl ? cmd.cx! : cmd.x;
      this.selectedY = isControl ? cmd.cy! : cmd.y;
}
    this.updateEditCanvas(); // Redraw to highlight the new point
}

updatePointFromInputs() {
  if (!this.selectedShape || !this.selectedPointIndex) return;
  const cmd = this.selectedShape.commands[this.selectedPointIndex.commandIndex];
  const isControl = this.selectedPointIndex.isControl;
  if (!isControl) {
    cmd.x = this.selectedX;
    cmd.y = this.selectedY;
  } else {
    cmd.cx = this.selectedX;
    cmd.cy = this.selectedY;
  }
  if (this.selectedVersionIndex !== null) {
    this.selectedVersionIndex = null;
  }
  this.updateLayers();
  this.updateEditCanvas();
}

updateLayerColor(layerIndex: number, type: 'fill' | 'stroke', color: string) {
  const styleCmd = this.layers[layerIndex].commands[0];
  if (type === 'fill') {
    styleCmd.fillColor = color;
  } else {
    styleCmd.strokeColor = color;
  }
  if (this.selectedVersionIndex !== null) {
    this.selectedVersionIndex = null;
  }
  this.updateEditCanvas();
}

private updateLayers() {
  this.layers = this.extractLayers(this.selectedShape!.commands).map(commands => ({commands, visible: true}));
  setTimeout(() => this.drawLayerPreviews(), 0);
}

saveVersion() {
  if (!this.selectedShape) return;
  const charId = this.selectedShape.charId;
  const newVersion = { name: `Version ${this.currentVersions.length + 1}`, commands: JSON.parse(JSON.stringify(this.selectedShape.commands)) };
  this.shapeVersions[charId].versions.push(newVersion);
  this.currentVersions = this.shapeVersions[charId].versions;
  this.selectedVersionIndex = this.currentVersions.length - 1;
}

loadVersion(index: number) {
  if (!this.selectedShape) return;
  this.selectedShape.commands = JSON.parse(JSON.stringify(this.currentVersions[index].commands));
  this.selectedVersionIndex = index;
  this.updateLayers();
  this.updateEditCanvas();
}

revertToOriginal() {
  if (!this.selectedShape) return;
  const charId = this.selectedShape.charId;
  this.selectedShape.commands = JSON.parse(JSON.stringify(this.shapeVersions[charId].original));
  this.selectedVersionIndex = null;
  this.updateLayers();
  this.updateEditCanvas();
}

private extractLayers(commands: VectorCommand[]): VectorCommand[][] {
  const layers: VectorCommand[][] = [];
  let current: VectorCommand[] = [];
  commands.forEach(cmd => {
    if (cmd.type === 'STYLE') {
      if (current.length > 0) {
        layers.push(current);
      }
      current = [cmd];
    } else {
      current.push(cmd);
    }
  });
  if (current.length > 0) {
    layers.push(current);
  }
  return layers;
}

private drawLayerPreviews() {
  this.layerPreviews.forEach((ref, i) => {
    const cvs = ref.nativeElement;
    const ctx = cvs.getContext('2d')!;
    ctx.fillStyle = '#333';
    ctx.fillRect(0, 0, cvs.width, cvs.height);
    const cmds = this.layers[i].commands;
    if (cmds.length === 0) return;
    const points = this.extractPoints(cmds);
    const bounds = this.getBounds(points);
    const maxDim = Math.max(bounds.width, bounds.height);
    const targetSize = 40;
    let scale = 1;
    if (maxDim > 0) {
      scale = targetSize / maxDim;
    }
    ctx.save();
    ctx.translate(50, 50);
    ctx.scale(scale, scale);
    ctx.translate(-bounds.cx, -bounds.cy);
    this.drawCommands(ctx, cmds, scale);
    ctx.restore();
  });
}

ngAfterViewInit() {
    this.drawEditCanvas();
this.editCtx = this.editCanvasRef.nativeElement.getContext('2d')!;
        this.editCanvasRef.nativeElement.addEventListener('mousedown', this.onEditCanvasMouseDown.bind(this));
        this.editCanvasRef.nativeElement.addEventListener('wheel', this.onWheel.bind(this));
// Mouse move/up listeners are added globally via @HostListener for robustness
    this.editCanvasRef.nativeElement.addEventListener('contextmenu', (e) => e.preventDefault()); // Prevent right-click menu
      this.canvasRef.nativeElement.addEventListener("click", (e) => {
      console.log("Canvas clicked!", e);
// Optional: Get actual click coordinates relative to canvas
const rect = this.canvasRef.nativeElement.getBoundingClientRect();
const x = e.clientX - rect.left;
const y = e.clientY - rect.top;
      console.log(`Coordinates: x=${x}, y=${y}`);
if(this.atlasDrawn){
  
const row_index=Math.floor(y/this.CELL_SIZE);
        console.log(Math.floor(row_index));
const col_index = Math.floor(x/this.CELL_SIZE);
        console.log(col_index)
        console.log(this.swfSprites[Math.floor(1920 / this.CELL_SIZE)*row_index+col_index])
          const shape = this.swfShapes[Math.floor(1920 / this.CELL_SIZE) * row_index + col_index];
  this.selectedShape = shape;
  

  // --- FIX 2: AUTO-CENTER AND FIT LOGIC ---
  const points = this.extractPoints(shape.commands);
  const bounds = this.getBounds(points);
  
  const editCvs = this.editCanvasRef.nativeElement;
  const padding = 50;

  // 1. Calculate a Zoom that allows the whole shape to fit in the canvas
  const scaleX = (editCvs.width - padding * 2) / bounds.width;
  const scaleY = (editCvs.height - padding * 2) / bounds.height;
  // Choose the smaller scale to ensure it fits, limit max zoom to 1
  this.zoom = Math.min(scaleX, scaleY, 1); 

  // 2. Calculate Offset to center the shape
  // Formula: ScreenCenter - (ShapeCenter * Zoom)
  this.shapeOffset = {
    x: (editCvs.width / 2) - (bounds.cx * this.zoom),
    y: (editCvs.height / 2) - (bounds.cy * this.zoom)
  };
  // ----------------------------------------

  this.selectedPointIndex = null;
  this.selectedX = 0;
  this.selectedY = 0;
  this.selectedVersionIndex = null;
  this.layers = this.extractLayers(shape.commands).map(commands => ({ commands, visible: true }));
  
  setTimeout(() => this.drawLayerPreviews(), 0);
  this.updateEditCanvas();
}
});
}
// --- RENDERING ATLAS ---
drawAtlas() {
    this.atlasDrawn = true;
const cvs = this.canvasRef.nativeElement;
const ctx = cvs.getContext('2d')!;
const viewWidth = this.screenWidth ? this.screenWidth/3*2 : 1920;
const cols = Math.floor(viewWidth / this.CELL_SIZE);
const rows = this.swfShapes.length > 0 ? Math.ceil(this.swfShapes.length / cols) : 1;
const newHeight = Math.max(1080, rows * this.CELL_SIZE);
    cvs.width = viewWidth;
    cvs.height = newHeight;
    ctx.fillStyle = "#222";
    ctx.fillRect(0, 0, cvs.width, cvs.height);
let colIndex = 0;
let rowIndex = 0;
    localStorage.setItem("cachedSwfShape", JSON.stringify(this.swfShapes));
    console.log(localStorage.getItem("cachedSwfShape"))
    localStorage.setItem("importedShapeName",JSON.stringify(this.importedShapeName));
    localStorage.setItem("swfSprites", JSON.stringify(this.swfSprites));
    localStorage.setItem("symbolMap", JSON.stringify(this.symbolMap));
    console.log(localStorage.getItem("importedShapeName"))
    console.log(localStorage.getItem("swfSprites"))
    console.log(localStorage.getItem("symbolMap"))
    this.swfShapes.forEach(shape => {
// 1. Compute Geometry
const points = this.extractPoints(shape.commands);
const bounds = this.getBounds(points);
const hull = this.getConvexHull(points);
// 2. Compute Scale to Fit Cell
const maxDim = Math.max(bounds.width, bounds.height);
const targetSize = this.CELL_SIZE - this.PADDING;
let scale = 1;
// If shape is bigger than cell, shrink it.
// If it's tiny (less than 1/4 cell), grow it (optional, helps visibility)
if (maxDim > targetSize) {
        scale = targetSize / maxDim;
} else if (maxDim > 0 && maxDim < targetSize / 3) {
        scale = (targetSize / 2) / maxDim;
}
// 3. Position
const cellX = colIndex * this.CELL_SIZE;
const cellY = rowIndex * this.CELL_SIZE;
const centerX = cellX + this.CELL_SIZE / 2;
const centerY = cellY + this.CELL_SIZE / 2;
      ctx.save();
// Move to Cell Center -> Scale -> Move Shape Center to 0,0
      ctx.translate(centerX, centerY);
      ctx.scale(scale, scale);
      ctx.translate(-bounds.cx, -bounds.cy);
// Draw Hull (Debug)
/*
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(0, 255, 255, 0.2)';
      ctx.lineWidth = 1 / scale;
      if (hull.length > 0) {
        ctx.moveTo(hull[0].x, hull[0].y);
        hull.forEach(p => ctx.lineTo(p.x, p.y));
        ctx.closePath();
        ctx.stroke();
      }
      */
// Draw Shape
      this.drawCommands(ctx, shape.commands, scale);
      ctx.restore();
      ctx.fillStyle = '#aaa';
      ctx.font = '11px sans-serif';
const name = this.symbolMap[shape.charId];
if (name) {
// Draw Name in Green/White to make it pop
        ctx.fillStyle = '#4caf50';
        ctx.fillText(name, cellX + 5, cellY + 15);
// Also draw ID smaller below it
        ctx.fillStyle = '#666';
        ctx.font = '9px sans-serif';
        ctx.fillText(`ID:${shape.charId}`, cellX + 5, cellY + 28);
} else {
// Just ID
        ctx.fillText(`ID:${shape.charId}`, cellX + 5, cellY + 15);
}
// Draw ID
      //ctx.fillStyle = '#aaa';
      //ctx.font = '10px Arial';
      //ctx.fillText(`ID:${shape.charId}`, cellX + 5, cellY + 12);
      colIndex++;
if (colIndex >= cols) { colIndex = 0; rowIndex++; }
});
}
drawCommands(ctx: CanvasRenderingContext2D, cmds: VectorCommand[], scale: number) {
    ctx.lineWidth = 1.5 / scale; // Keep lines crisp despite scaling
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = this.showColors ? 'transparent' : '#00ff00';
    ctx.beginPath();
let currentFill = 'transparent';
let currentStroke = this.showColors ? 'transparent' : '#00ff00';
    cmds.forEach(cmd => {
if (cmd.type === 'STYLE') {
if (this.showColors) {
if (currentFill !== 'transparent') { ctx.fillStyle = currentFill; ctx.fill(); }
if (currentStroke !== 'transparent') { ctx.strokeStyle = currentStroke; ctx.stroke(); }
} else {
           ctx.stroke();
}
        ctx.beginPath();
if (this.showColors) {
          currentFill = cmd.fillColor || 'transparent';
          currentStroke = cmd.strokeColor || 'transparent';
if (cmd.lineWidth) ctx.lineWidth = cmd.lineWidth / scale;
}
} else if (cmd.type === 'MOVE') ctx.moveTo(cmd.x, cmd.y);
else if (cmd.type === 'LINE') ctx.lineTo(cmd.x, cmd.y);
else if (cmd.type === 'CURVE') ctx.quadraticCurveTo(cmd.cx!, cmd.cy!, cmd.x, cmd.y);
});
if (this.showColors) {
if (currentFill !== 'transparent') { ctx.fillStyle = currentFill; ctx.fill(); }
if (currentStroke !== 'transparent') { ctx.strokeStyle = currentStroke; ctx.stroke(); }
} else {
       ctx.stroke();
}
}
// --- GEOMETRY HELPERS ---
extractPoints(cmds: VectorCommand[]): Point[] {
const pts: Point[] = [];
    cmds.forEach(c => {
if (c.type !== 'STYLE') {
        pts.push({x: c.x, y: c.y});
if (c.type === 'CURVE') pts.push({x: c.cx!, y: c.cy!});
}
});
return pts;
}
getBounds(points: Point[]): Bounds {
if (points.length === 0) return {minX:0, maxX:0, minY:0, maxY:0, width:0, height:0, cx:0, cy:0};
let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    points.forEach(p => {
if (p.x < minX) minX = p.x;
if (p.x > maxX) maxX = p.x;
if (p.y < minY) minY = p.y;
if (p.y > maxY) maxY = p.y;
});
return {
      minX, maxX, minY, maxY,
      width: maxX - minX, height: maxY - minY,
      cx: (minX + maxX) / 2, cy: (minY + maxY) / 2
};
}
getConvexHull(points: Point[]): Point[] {
if (points.length <= 2) return points;
    points.sort((a, b) => a.x === b.x ? a.y - b.y : a.x - b.x);
const cross = (o: Point, a: Point, b: Point) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
const lower: Point[] = [];
for (let p of points) {
while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
      lower.push(p);
}
const upper: Point[] = [];
for (let i = points.length - 1; i >= 0; i--) {
const p = points[i];
while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
      upper.push(p);
}
    upper.pop(); lower.pop();
return lower.concat(upper);
}
// --- DRAG/DROP & PASTE (Standard Logic) ---
onDragOver(e: DragEvent) { e.preventDefault(); this.isDragging = true; }
onDragLeave(e: DragEvent) { e.preventDefault(); this.isDragging = false; }
onDrop(e: DragEvent) {
    e.preventDefault(); this.isDragging = false;
if (e.dataTransfer?.files[0]) this.uploadSwf(e.dataTransfer.files[0]);
}
@HostListener('window:paste', ['$event'])
handlePaste(event: ClipboardEvent) {
const items = event.clipboardData?.items;
if (!items) return;
for (let i = 0; i < items.length; i++) {
if (items[i].type.indexOf('image') !== -1) {
const blob = items[i].getAsFile();
        this.loadImage(blob!);
break;
}
}
}
loadImage(file: Blob) {
const img = new Image();
const url = URL.createObjectURL(file);
    img.onload = () => {
const cvs = this.canvasRef.nativeElement;
const ctx = cvs.getContext('2d')!;
      cvs.width = img.width;
      cvs.height = img.height;
      ctx.drawImage(img, 0, 0);
      this.hasImage = true;
};
    img.src = url;
}
// --- 5. SOLVER ---
solvePuzzle() {
    this.canvasRef.nativeElement.toBlob((blob) => {
const formData = new FormData();
      formData.append('screenshot', blob!, 'screen.png');
      this.http.post('http://localhost:8080/api/puzzle/solve', formData)
.subscribe(() => {
setTimeout(() => {
            this.resultUrl = 'http://localhost:8080/custom/puzzle_solved.png?t=' + Date.now();
}, 5000);
});
});
}
}