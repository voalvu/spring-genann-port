package com.ai.service;

import com.ai.api.SwfResponse;
import com.ai.api.SwfShape;
import com.ai.api.VectorCommand;
import com.ai.entity.VectorLayer;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.HashMap;
import java.awt.geom.GeneralPath;

// JPEXS Core Imports
import com.jpexs.decompiler.flash.SWF;
import com.jpexs.decompiler.flash.tags.Tag;
import com.jpexs.decompiler.flash.tags.base.ShapeTag; // <--- The Parent Class
import com.jpexs.decompiler.flash.tags.DefineShapeTag;
import com.jpexs.decompiler.flash.tags.DefineShape4Tag; // <--- The specific tag you wanted
import com.jpexs.decompiler.flash.tags.DefineSpriteTag;
import com.jpexs.decompiler.flash.tags.SymbolClassTag;
import com.jpexs.decompiler.flash.types.SHAPE;
import com.jpexs.decompiler.flash.types.RGB;
import com.jpexs.decompiler.flash.types.RGBA;
import com.jpexs.decompiler.flash.types.GRADRECORD;
import com.jpexs.decompiler.flash.types.ColorTransform;
import com.jpexs.decompiler.flash.types.MATRIX;

// JPEXS Timeline Imports
import com.jpexs.decompiler.flash.timeline.Timeline;
import com.jpexs.decompiler.flash.timeline.Frame;
import com.jpexs.decompiler.flash.timeline.DepthState;

// JPEXS Exporter Imports
import com.jpexs.decompiler.flash.exporters.shape.ShapeExporterBase;
import com.jpexs.decompiler.flash.exporters.commonshape.Matrix;

import com.ai.api.SwfInstance;
import com.ai.api.SwfSprite;

@Service
public class SwfService {

    private List<VectorLayer> loadedLayers = new ArrayList<>();

    public SwfResponse parseSwf(MultipartFile file) {
        System.out.println("--- Parsing SWF: " + file.getOriginalFilename() + " ---");
        SwfResponse response = new SwfResponse();
        response.setName(file.getOriginalFilename());
        
        List<SwfShape> extractedShapes = new ArrayList<>();
        List<SwfSprite> extractedSprites = new ArrayList<>(); 
        Map<Integer, String> symbolMap = new HashMap<>();
        
        loadedLayers.clear();
        
        try (InputStream is = file.getInputStream()) {
            SWF swf = new SWF(is, null, false);
            
            for (Tag tag : swf.getTags()) {
                
                // --- SHAPES (POLYMORPHIC SUPPORT) ---
                // This covers DefineShape, DefineShape2, DefineShape3, DefineShape4
                if (tag instanceof ShapeTag) {
                    ShapeTag shapeTag = (ShapeTag) tag;
                    
                    // getShapes() is available on the base ShapeTag class
                    SHAPE shape = shapeTag.getShapes();
                    
                    AngularShapeExporter exporter = new AngularShapeExporter(swf, shape);
                    exporter.export(); 
                    
                    List<VectorCommand> shapeCommands = exporter.getCommands();
                    
                    extractedShapes.add(new SwfShape(shapeTag.getCharacterId(), shapeCommands));
                    
                    VectorLayer layer = new VectorLayer();
                    layer.setName("Char_" + shapeTag.getCharacterId());
                    layer.setVectorShape(reconstructPath(shapeCommands));
                    loadedLayers.add(layer);
                }
                
                // --- SPRITES (MovieClips) ---
                else if (tag instanceof DefineSpriteTag) {
                    DefineSpriteTag spriteTag = (DefineSpriteTag) tag;
                    extractedSprites.add(parseTimeline(spriteTag));
                }
                
                // --- SYMBOLS (Names) ---
                else if (tag instanceof SymbolClassTag) {
                    SymbolClassTag sct = (SymbolClassTag) tag;
                    symbolMap.putAll(sct.getTagToNameMap());
                    symbolMap.forEach((key, value) -> System.out.println(key + " " + value));
                }
            }
            
            System.out.println("Extraction Complete. Shapes: " + extractedShapes.size() + ", Sprites: " + extractedSprites.size());

        } catch (Exception e) {
            e.printStackTrace();
        }

        response.setShapes(extractedShapes);
        response.setSprites(extractedSprites);
        response.setSymbolMap(symbolMap);
        return response;
    }

    private SwfSprite parseTimeline(DefineSpriteTag spriteTag) {
        SwfSprite swfSprite = new SwfSprite();
        swfSprite.setSpriteId(spriteTag.getCharacterId());
        swfSprite.setFrameCount(spriteTag.getFrameCount());
        
        List<List<SwfInstance>> allFrames = new ArrayList<>();
        Timeline timeline = spriteTag.getTimeline();
        
        for (Frame frameObj : timeline.getFrames()) {
            List<SwfInstance> currentFrameInstances = new ArrayList<>();
            for (Map.Entry<Integer, DepthState> entry : frameObj.layers.entrySet()) {
                int depth = entry.getKey();
                DepthState state = entry.getValue();
                
                if (state.isVisible && state.characterId != -1) {
                    SwfInstance inst = new SwfInstance();
                    inst.setCharId(state.characterId);
                    inst.setDepth(depth);
                    if (state.matrix != null) {
                        inst.setMatrix(convertMatrix(state.matrix));
                    }
                    currentFrameInstances.add(inst);
                }
            }
            allFrames.add(currentFrameInstances);
        }
        
        swfSprite.setFrames(allFrames);
        return swfSprite;
    }

    private double[] convertMatrix(MATRIX m) {
        if (m == null) return null;
        return new double[] {
            m.scaleX, m.rotateSkew0, m.rotateSkew1, m.scaleY,
            m.translateX / 20.0, m.translateY / 20.0
        };
    }

    public List<VectorLayer> loadSwfLayers() {
        return new ArrayList<>(loadedLayers);
    }

    private java.awt.Shape reconstructPath(List<VectorCommand> cmds) {
        GeneralPath path = new GeneralPath();
        for(VectorCommand cmd : cmds) {
            if(cmd.getType().equals("MOVE")) path.moveTo(cmd.getX(), cmd.getY());
            else if(cmd.getType().equals("LINE")) path.lineTo(cmd.getX(), cmd.getY());
            else if(cmd.getType().equals("CURVE")) path.quadTo(cmd.getCx(), cmd.getCy(), cmd.getX(), cmd.getY());
        }
        return path;
    }

    // =========================================================================
    //  CUSTOM EXPORTER IMPLEMENTATION
    // =========================================================================
    private static class AngularShapeExporter extends ShapeExporterBase {
        
        private final List<VectorCommand> commands = new ArrayList<>();
        private String currentFill = null;
        private String currentStroke = null;
        private double currentLineWidth = 0;

        public AngularShapeExporter(SWF swf, SHAPE shape) {
            super(0, 1, swf, shape, null);
        }

        public List<VectorCommand> getCommands() {
            return commands;
        }

        @Override
        public void beginFill(RGB color) {
            this.currentFill = colorToCss(color);
            emitStyle();
        }

        @Override
        public void beginGradientFill(int type, GRADRECORD[] colors, Matrix matrix, int spreadMode, int interpolationMode, float focalPoint) {
            if(colors != null && colors.length > 0) {
                this.currentFill = colorToCss(colors[0].color);
            } else {
                this.currentFill = "rgba(128,128,128,0.5)";
            }
            emitStyle();
        }

        @Override
        public void beginBitmapFill(int bitmapId, Matrix matrix, boolean repeat, boolean smooth, ColorTransform colorTransform) {
            this.currentFill = "rgba(200,200,200,0.5)"; 
            emitStyle();
        }

        @Override
        public void lineStyle(double width, RGB color, boolean pixelHinting, String scaleMode, int startCapStyle, int endCapStyle, int joinStyle, float miterLimitFactor, boolean noClose) {
            this.currentStroke = colorToCss(color);
            this.currentLineWidth = width / 20.0;
            emitStyle();
        }

        @Override
        public void lineGradientStyle(int type, GRADRECORD[] colors, Matrix matrix, int spreadMode, int interpolationMode, float focalPoint) {
            if(colors != null && colors.length > 0) {
                this.currentStroke = colorToCss(colors[0].color);
            }
            emitStyle();
        }
        
        @Override
        public void lineBitmapStyle(int bitmapId, Matrix matrix, boolean repeat, boolean smooth, ColorTransform colorTransform) {
             this.currentStroke = "rgba(0,0,0,1)";
             emitStyle();
        }

        @Override
        public void endFill() {
            this.currentFill = null; 
            emitStyle();
        }

        @Override
        public void endLines(boolean close) {
            this.currentStroke = null; 
            this.currentLineWidth = 0;
            emitStyle();
        }

        @Override
        public void moveTo(double x, double y) {
            commands.add(new VectorCommand("MOVE", x / 20.0, y / 20.0));
        }

        @Override
        public void lineTo(double x, double y) {
            commands.add(new VectorCommand("LINE", x / 20.0, y / 20.0));
        }

        @Override
        public void curveTo(double cx, double cy, double x, double y) {
            commands.add(new VectorCommand("CURVE", cx / 20.0, cy / 20.0, x / 20.0, y / 20.0));
        }

        private void emitStyle() {
            commands.add(new VectorCommand("STYLE", currentFill, currentStroke, currentLineWidth));
        }

        private String colorToCss(RGB rgb) {
            if (rgb == null) return null;
            int r = rgb.red;
            int g = rgb.green;
            int b = rgb.blue;
            double a = 1.0;
            if (rgb instanceof RGBA) {
                a = ((RGBA) rgb).alpha / 255.0;
            }
            return String.format("rgba(%d,%d,%d,%.2f)", r, g, b, a);
        }
        
        @Override public void beginShape() {}
        @Override public void endShape() {}
        @Override public void endFills() {} 
        @Override public void beginLines() {} 
        @Override public void beginFills() {}
    }
}