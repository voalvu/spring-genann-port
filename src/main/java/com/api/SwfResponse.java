package com.ai.api;

import lombok.Data;
import java.util.List;
import com.jpexs.decompiler.flash.tags.SymbolClassTag;
import java.util.HashMap;
import java.util.Map;

@Data
public class SwfResponse {
    private String name;
    private List<SwfShape> shapes;
    private List<SwfSprite> sprites;
    private Map<Integer, String> symbolMap;
}