package com.ai.api;

import lombok.Data;
import java.util.List;

@Data
public class SwfResponse {
    private String name;
    private List<VectorCommand> commands;
}