package com.ai.api;

import lombok.Data;

@Data
public class SwfInstance {
    private int charId;
    private int depth;
    private double[] matrix; 
}