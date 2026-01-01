package com.ai.entity;

import lombok.Data;
import java.awt.Shape;

@Data
public class VectorLayer {
    private String name;
    private Shape vectorShape; // Java2D Shape (GeneralPath)
    private double defaultX, defaultY;
}