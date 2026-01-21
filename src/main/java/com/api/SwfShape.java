package com.ai.api;

import lombok.Data;
import java.util.List;

@Data
public class SwfShape {
    private int charId;
    private List<VectorCommand> commands;

    public SwfShape(int charId, List<VectorCommand> commands) {
        this.charId = charId;
        this.commands = commands;
    }
}