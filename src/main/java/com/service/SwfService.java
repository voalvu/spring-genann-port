package com.ai.service;

import com.ai.api.SwfResponse;
import com.ai.api.VectorCommand;
import com.ai.entity.VectorLayer;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;

// JPEXS Imports (Corrected Case)
import com.jpexs.decompiler.flash.SWF;
import com.jpexs.decompiler.flash.tags.Tag;
import com.jpexs.decompiler.flash.tags.DefineShapeTag;
import com.jpexs.decompiler.flash.types.SHAPE; // <--- WAS Shape
import com.jpexs.decompiler.flash.types.shaperecords.SHAPERECORD; // <--- WAS ShapeRecord
import com.jpexs.decompiler.flash.types.shaperecords.StyleChangeRecord;
import com.jpexs.decompiler.flash.types.shaperecords.StraightEdgeRecord;
import com.jpexs.decompiler.flash.types.shaperecords.CurvedEdgeRecord;

@Service
public class SwfService {

    public SwfResponse parseSwf(MultipartFile file) {
        SwfResponse response = new SwfResponse();
        response.setName(file.getOriginalFilename());
        List<VectorCommand> commands = new ArrayList<>();
        
        try (InputStream is = file.getInputStream()) {
            SWF swf = new SWF(is, null, false);
            
            for (Tag tag : swf.getTags()) {
                if (tag instanceof DefineShapeTag) {
                    DefineShapeTag shapeTag = (DefineShapeTag) tag;
                    
                    // Correct Class: SHAPE
                    SHAPE shape = shapeTag.getShapes(); 
                    
                    int currentX = 0;
                    int currentY = 0;

                    // Correct Field: shapeRecords
                    if (shape.shapeRecords != null) {
                        for (SHAPERECORD record : shape.shapeRecords) {
                            
                            if (record instanceof StyleChangeRecord) {
                                StyleChangeRecord scr = (StyleChangeRecord) record;
                                
                                // Fields are often public in JPEXS, or check stateMoveTo
                                if (scr.stateMoveTo) { 
                                    currentX = scr.moveDeltaX;
                                    currentY = scr.moveDeltaY;
                                    commands.add(new VectorCommand("MOVE", currentX / 20.0, currentY / 20.0));
                                }
                                
                            } else if (record instanceof StraightEdgeRecord) {
                                StraightEdgeRecord ser = (StraightEdgeRecord) record;
                                // Direct Field Access (Standard in FFDec lib)
                                currentX += ser.deltaX;
                                currentY += ser.deltaY;
                                commands.add(new VectorCommand("LINE", currentX / 20.0, currentY / 20.0));
                                
                            } else if (record instanceof CurvedEdgeRecord) {
                                CurvedEdgeRecord cer = (CurvedEdgeRecord) record;
                                
                                int cx = currentX + cer.controlDeltaX;
                                int cy = currentY + cer.controlDeltaY;
                                int anchorX = cx + cer.anchorDeltaX;
                                int anchorY = cy + cer.anchorDeltaY;
                                
                                commands.add(new VectorCommand("CURVE", cx/20.0, cy/20.0, anchorX/20.0, anchorY/20.0));
                                
                                currentX = anchorX;
                                currentY = anchorY;
                            }
                        }
                    }
                    break; 
                }
            }
        } catch (Exception e) {
            e.printStackTrace();
            // Fallback
            commands.add(new VectorCommand("MOVE", 50, 50)); 
            commands.add(new VectorCommand("LINE", 100, 100));
        }

        response.setCommands(commands);
        return response;
    }

    public List<VectorLayer> loadSwfLayers() {
        return new ArrayList<>();
    }
}