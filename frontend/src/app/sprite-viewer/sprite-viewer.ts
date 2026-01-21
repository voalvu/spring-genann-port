import { Component, Input, ViewChild, ElementRef, OnChanges, SimpleChanges } from '@angular/core';

// --- INTERFACES ---
interface VectorCommand {
  type: string; x: number; y: number; cx?: number; cy?: number;
  fillColor?: string; strokeColor?: string; lineWidth?: number;
}
interface SwfShape { charId: number; commands: VectorCommand[]; }
interface SwfInstance { charId: number; depth: number; matrix: number[]; }
interface SwfSprite { spriteId: number; frameCount: number; frames: SwfInstance[][]; }
interface Point { x: number; y: number; }
interface Bounds { minX: number; maxX: number; minY: number; maxY: number; }

@Component({
  selector: 'app-sprite-viewer',
  standalone: false,
  templateUrl: './sprite-viewer.html',
  styleUrls: ['./sprite-viewer.css']
})
export class SpriteViewer implements OnChanges {
  @Input() shapes: SwfShape[] = [];
  @Input() sprites: SwfSprite[] = [];
  @Input() symbolMap: { [key: number]: string } = {};

  @ViewChild('spriteCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;

  selectedSprite: SwfSprite | null = null;
  selectedSpriteId: number | null = null;
  currentFrameIndex: number = 0;
  enableTransforms: boolean = true; 
  
  // Lookup Tables
  shapeMap: Map<number, SwfShape> = new Map();
  spriteMap: Map<number, SwfSprite> = new Map();
  private boundsCache: Map<number, Bounds> = new Map();

  get maxFrameIndex(): number {
    return this.selectedSprite ? Math.max(0, this.selectedSprite.frames.length - 1) : 0;
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['shapes'] && this.shapes) {
      this.shapeMap.clear();
      this.shapes.forEach(s => this.shapeMap.set(s.charId, s));
    }
    
    if (changes['sprites'] && this.sprites) {
      this.spriteMap.clear();
      this.boundsCache.clear();
      this.sprites.forEach(s => this.spriteMap.set(s.spriteId, s));
      
      if (this.sprites.length > 0 && !this.selectedSpriteId) {
        this.selectSprite(this.sprites[0].spriteId);
      }
    }
  }

  selectSprite(id: number) {
    const numericId = Number(id);
    this.selectedSpriteId = numericId;
    this.selectedSprite = this.sprites.find(s => s.spriteId === numericId) || null;
    this.currentFrameIndex = 0;

    // --- DEBUGGING LOGS ---
    if (this.selectedSprite) {
      console.group(`%cSelected Sprite ID: ${numericId}`, 'color: #00ff00; font-weight: bold;');
      const name = this.symbolMap[numericId] || "Unknown";
      console.log(`Name: ${name}`);
      console.log(`Frames: ${this.selectedSprite.frames.length}`);
      
      if (this.selectedSprite.frames.length > 0) {
        console.groupCollapsed('Frame 0 Contents');
        this.selectedSprite.frames[0].forEach((inst, i) => {
          const type = this.shapeMap.has(inst.charId) ? 'SHAPE' : (this.spriteMap.has(inst.charId) ? 'SPRITE' : 'UNKNOWN');
          
          // Debug the raw matrix vs the sanitized one
          let mStr = "Identity";
          if (inst.matrix) {
             const raw = inst.matrix;
             const fixed = this.sanitizeMatrix(inst.matrix); // Check what the fix does
             mStr = `[ScaleX:${raw[0].toFixed(2)}->${fixed[0]}, ScaleY:${raw[3].toFixed(2)}->${fixed[3]}, Tx:${raw[4]}, Ty:${raw[5]}]`;
          }

          console.log(`[Obj ${i}] Depth: ${inst.depth} | ID: ${inst.charId} (${type}) | Matrix: ${mStr}`);
        });
        console.groupEnd();
      }
      console.groupEnd();
    } 

    this.renderFrame();
  }

  // --- HELPER: Fix Zero Scales ---
  // If ScaleX or ScaleY is ~0, force it to 1 so the object is visible.
  sanitizeMatrix(m: number[]): number[] {
    const safe = [...m]; // Clone
    if (Math.abs(safe[0]) < 0.001) safe[0] = 1; // Fix Scale X
    if (Math.abs(safe[3]) < 0.001) safe[3] = 1; // Fix Scale Y
    return safe;
  }

  // --- PLAYBACK ---
  nextFrame() {
    this.currentFrameIndex = (this.currentFrameIndex + 1) % (this.maxFrameIndex + 1);
    this.renderFrame();
  }

  prevFrame() {
    this.currentFrameIndex = (this.currentFrameIndex - 1 + (this.maxFrameIndex + 1)) % (this.maxFrameIndex + 1);
    this.renderFrame();
  }

  getDisplayName(id: number): string {
    return this.symbolMap[id] ? `${this.symbolMap[id]} (ID: ${id})` : `Sprite ID: ${id}`;
  }

  // --- RENDERER ---

  renderFrame() {
    if (!this.selectedSprite || !this.canvasRef) return;
    
    const cvs = this.canvasRef.nativeElement;
    const ctx = cvs.getContext('2d')!;
    
    // Safety check
    if (!this.selectedSprite.frames || this.selectedSprite.frames.length === 0) return;

    const frame = this.selectedSprite.frames[this.currentFrameIndex];

    // 1. Calculate Bounds
    const IDENTITY = [1, 0, 0, 1, 0, 0];
    let bounds = this.calculateRecursiveBounds(frame, IDENTITY, this.enableTransforms);

    // 2. Clear
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#333";
    ctx.fillRect(0, 0, cvs.width, cvs.height);

    if (!isFinite(bounds.minX)) {
        bounds = { minX: -100, maxX: 100, minY: -100, maxY: 100 }; 
    }

    // 3. Setup Camera
    const contentW = bounds.maxX - bounds.minX;
    const contentH = bounds.maxY - bounds.minY;
    const contentCx = bounds.minX + contentW / 2;
    const contentCy = bounds.minY + contentH / 2;

    const padding = 50;
    const scaleX = (cvs.width - padding) / (contentW || 1);
    const scaleY = (cvs.height - padding) / (contentH || 1);
    let scale = Math.min(scaleX, scaleY);
    
    if (!isFinite(scale) || scale === 0) scale = 1;
    if (scale > 10) scale = 10; 

    ctx.translate(cvs.width / 2, cvs.height / 2);
    ctx.scale(scale, scale);
    ctx.translate(-contentCx, -contentCy);

    // 4. Draw
    this.drawRecursive(ctx, frame, 0); 
  }

  calculateRecursiveBounds(instances: SwfInstance[], parentMatrix: number[], applyMatrix: boolean): Bounds {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    for (const inst of instances) {
        // APPLY FIX HERE: Sanitize the instance matrix if it exists
        let localMatrix = [1,0,0,1,0,0];
        if (applyMatrix && inst.matrix) {
            localMatrix = this.sanitizeMatrix(inst.matrix);
        }

        const m = this.multiplyMatrices(parentMatrix, localMatrix);

        if (this.shapeMap.has(inst.charId)) {
            const shape = this.shapeMap.get(inst.charId)!;
            const points = this.extractPoints(shape.commands);
            
            for (const p of points) {
                const tx = (m[0] * p.x) + (m[2] * p.y) + m[4];
                const ty = (m[1] * p.x) + (m[3] * p.y) + m[5];
                
                if (isFinite(tx) && isFinite(ty)) {
                    if(tx < minX) minX = tx; if(tx > maxX) maxX = tx;
                    if(ty < minY) minY = ty; if(ty > maxY) maxY = ty;
                }
            }
        }
        else if (this.spriteMap.has(inst.charId)) {
            const sprite = this.spriteMap.get(inst.charId)!;
            let spriteLocalBounds = this.boundsCache.get(inst.charId);
            
            if (!spriteLocalBounds) {
                spriteLocalBounds = this.calculateSpriteOverallBounds(sprite);
                this.boundsCache.set(inst.charId, spriteLocalBounds);
            }

            if (isFinite(spriteLocalBounds.minX)) {
                const corners = [
                    {x: spriteLocalBounds.minX, y: spriteLocalBounds.minY},
                    {x: spriteLocalBounds.maxX, y: spriteLocalBounds.minY},
                    {x: spriteLocalBounds.maxX, y: spriteLocalBounds.maxY},
                    {x: spriteLocalBounds.minX, y: spriteLocalBounds.maxY}
                ];

                for (const p of corners) {
                    const tx = (m[0] * p.x) + (m[2] * p.y) + m[4];
                    const ty = (m[1] * p.x) + (m[3] * p.y) + m[5];
                    if(tx < minX) minX = tx; if(tx > maxX) maxX = tx;
                    if(ty < minY) minY = ty; if(ty > maxY) maxY = ty;
                }
            }
        }
    }

    return { minX, maxX, minY, maxY };
  }

  calculateSpriteOverallBounds(sprite: SwfSprite): Bounds {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      const IDENTITY = [1, 0, 0, 1, 0, 0];

      for (const frame of sprite.frames) {
          // Use sanitize=true here so the bounds calculation includes the zero-scaled items
          // (assuming we want to see them eventually)
          const b = this.calculateRecursiveBounds(frame, IDENTITY, true);
          if (isFinite(b.minX)) {
              if (b.minX < minX) minX = b.minX;
              if (b.maxX > maxX) maxX = b.maxX;
              if (b.minY < minY) minY = b.minY;
              if (b.maxY > maxY) maxY = b.maxY;
          }
      }
      return { minX, maxX, minY, maxY };
  }

  drawRecursive(ctx: CanvasRenderingContext2D, instances: SwfInstance[], timeOffset: number) {
      const sorted = [...instances].sort((a,b) => a.depth - b.depth);

      sorted.forEach(inst => {
          ctx.save();
          
          if (this.enableTransforms && inst.matrix) {
              // APPLY FIX HERE: Use sanitized matrix
              const m = this.sanitizeMatrix(inst.matrix);
              ctx.transform(m[0], m[1], m[2], m[3], m[4], m[5]);
          }

          if (this.shapeMap.has(inst.charId)) {
              this.drawShape(ctx, this.shapeMap.get(inst.charId)!);
          }
          else if (this.spriteMap.has(inst.charId)) {
              const sprite = this.spriteMap.get(inst.charId)!;
              if (sprite.frames.length > 0) {
                  const subFrameIndex = (this.currentFrameIndex + timeOffset) % sprite.frames.length;
                  this.drawRecursive(ctx, sprite.frames[subFrameIndex], timeOffset + 1);
              }
          }

          ctx.restore();
      });
  }

  multiplyMatrices(m1: number[], m2: number[]): number[] {
    if (!m1) m1 = [1,0,0,1,0,0];
    if (!m2) m2 = [1,0,0,1,0,0];
    return [
        m1[0]*m2[0] + m1[2]*m2[1],        
        m1[1]*m2[0] + m1[3]*m2[1],        
        m1[0]*m2[2] + m1[2]*m2[3],        
        m1[1]*m2[2] + m1[3]*m2[3],        
        m1[0]*m2[4] + m1[2]*m2[5] + m1[4], 
        m1[1]*m2[4] + m1[3]*m2[5] + m1[5]  
    ];
  }

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

  drawShape(ctx: CanvasRenderingContext2D, shape: SwfShape) {
    ctx.beginPath();
    let currentFill = 'transparent';
    let currentStroke = 'transparent';

    shape.commands.forEach(cmd => {
      if (cmd.type === 'STYLE') {
        if (currentFill !== 'transparent') { ctx.fillStyle = currentFill; ctx.fill(); }
        if (currentStroke !== 'transparent') { ctx.strokeStyle = currentStroke; ctx.stroke(); }
        ctx.beginPath();
        currentFill = cmd.fillColor || 'transparent';
        currentStroke = cmd.strokeColor || 'transparent';
        if (cmd.lineWidth) ctx.lineWidth = cmd.lineWidth;
      } else if (cmd.type === 'MOVE') ctx.moveTo(cmd.x, cmd.y);
      else if (cmd.type === 'LINE') ctx.lineTo(cmd.x, cmd.y);
      else if (cmd.type === 'CURVE') ctx.quadraticCurveTo(cmd.cx!, cmd.cy!, cmd.x, cmd.y);
    });

    if (currentFill !== 'transparent') { ctx.fillStyle = currentFill; ctx.fill(); }
    if (currentStroke !== 'transparent') { ctx.strokeStyle = currentStroke; ctx.stroke(); }
  }
}