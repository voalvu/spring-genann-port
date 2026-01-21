package com.ai.api;

import lombok.Data;
import java.util.List;

@Data
public class SwfSprite {
    private int spriteId;
    private int frameCount;
    private List<List<SwfInstance>> frames;
}