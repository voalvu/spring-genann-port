package com.ai.core;

import java.io.Serializable;
import java.util.Random;

/**
 * Direct port of genann.c to Java.
 */
public class GenAnn implements Serializable {
    private final int inputs;
    private final int hiddenLayers;
    private final int hidden;
    private final int outputs;
    private final double[] weights;
    private final int totalWeights;
    
    // Transients for runtime calculations (scratch memory)
    private transient double[] outputNeurons; 
    private transient double[] deltas;

    private static final Random rand = new Random();

    public GenAnn(int inputs, int hiddenLayers, int hidden, int outputs) {
        this.inputs = inputs;
        this.hiddenLayers = hiddenLayers;
        this.hidden = hidden;
        this.outputs = outputs;

        int hiddenWeights = hiddenLayers > 0 ? (inputs + 1) * hidden + (hiddenLayers - 1) * (hidden + 1) * hidden : 0;
        int outputWeights = (hiddenLayers > 0 ? (hidden + 1) : (inputs + 1)) * outputs;
        this.totalWeights = hiddenWeights + outputWeights;
        
        this.weights = new double[totalWeights];
        randomize();
        initScratch();
    }

    private void initScratch() {
        int totalNeurons = inputs + hidden * hiddenLayers + outputs;
        this.outputNeurons = new double[totalNeurons];
        this.deltas = new double[totalNeurons];
    }
    
    // Restore scratch memory after deserialization
    public Object readResolve() {
        initScratch();
        return this;
    }

    public void randomize() {
        for (int i = 0; i < totalWeights; i++) {
            weights[i] = rand.nextDouble() - 0.5;
        }
    }

    private double sigmoid(double a) {
        if (a < -45.0) return 0;
        if (a > 45.0) return 1;
        return 1.0 / (1 + Math.exp(-a));
    }

    public double[] run(double[] inputVector) {
        // Copy inputs to scratch output array
        System.arraycopy(inputVector, 0, outputNeurons, 0, inputs);

        int wIdx = 0;
        int oIdx = inputs;
        int iIdx = 0;

        // Input to Hidden
        if (hiddenLayers > 0) {
            for (int j = 0; j < hidden; ++j) {
                double sum = weights[wIdx++] * -1.0; // Bias
                for (int k = 0; k < inputs; ++k) {
                    sum += weights[wIdx++] * outputNeurons[iIdx + k];
                }
                outputNeurons[oIdx++] = sigmoid(sum);
            }
            iIdx += inputs;

            // Hidden to Hidden
            for (int h = 1; h < hiddenLayers; ++h) {
                for (int j = 0; j < hidden; ++j) {
                    double sum = weights[wIdx++] * -1.0;
                    for (int k = 0; k < hidden; ++k) {
                        sum += weights[wIdx++] * outputNeurons[iIdx + k];
                    }
                    outputNeurons[oIdx++] = sigmoid(sum);
                }
                iIdx += hidden;
            }
        }

        // Hidden (or Input) to Output
        double[] ret = new double[outputs];
        int retIdx = 0;
        for (int j = 0; j < outputs; ++j) {
            double sum = weights[wIdx++] * -1.0;
            int prevLayerSize = (hiddenLayers > 0) ? hidden : inputs;
            for (int k = 0; k < prevLayerSize; ++k) {
                sum += weights[wIdx++] * outputNeurons[iIdx + k];
            }
            double val = sigmoid(sum);
            outputNeurons[oIdx++] = val;
            ret[retIdx++] = val;
        }
        
        return ret;
    }

    public void train(double[] inputs, double[] desiredOutputs, double learningRate) {
        run(inputs); // Forward pass

        // 1. Output Layer Deltas
        int oIdx = this.inputs + this.hidden * this.hiddenLayers;
        int dIdx = this.hidden * this.hiddenLayers; // Delta index for output
        
        for (int j = 0; j < outputs; ++j) {
            double o = outputNeurons[oIdx + j];
            double t = desiredOutputs[j];
            deltas[dIdx + j] = (t - o) * o * (1.0 - o);
        }

        // 2. Hidden Layer Deltas
        for (int h = hiddenLayers - 1; h >= 0; --h) {
            int currentHiddenIdx = h * hidden; // delta index
            int nextLayerDeltaIdx = (h + 1) * hidden; // could be hidden or output start
            
            // Pointer to weights connecting this layer to next
            // (Calculated mathematically based on layer sizes)
            int wStart = (this.inputs + 1) * this.hidden + (this.hidden + 1) * this.hidden * h;
            
            for (int j = 0; j < hidden; ++j) {
                double deltaSum = 0;
                int nextLayerSize = (h == hiddenLayers - 1 ? outputs : hidden);
                
                for (int k = 0; k < nextLayerSize; ++k) {
                    double forwardDelta = deltas[nextLayerDeltaIdx + k];
                    int wIndex = wStart + (k * (hidden + 1) + (j + 1));
                    deltaSum += forwardDelta * weights[wIndex];
                }
                
                double o = outputNeurons[this.inputs + currentHiddenIdx + j];
                deltas[currentHiddenIdx + j] = o * (1.0 - o) * deltaSum;
            }
        }

        // 3. Update Weights
        // Output Weights
        int wIdx = (hiddenLayers > 0) 
            ? ((this.inputs + 1) * this.hidden + (this.hidden + 1) * this.hidden * (this.hiddenLayers - 1)) 
            : 0;
        
        int prevOutIdx = (hiddenLayers > 0) 
            ? (this.inputs + (this.hidden) * (this.hiddenLayers - 1)) 
            : 0;
            
        int outputDeltaIdx = this.hidden * this.hiddenLayers;

        for (int j = 0; j < outputs; ++j) {
            weights[wIdx++] += deltas[outputDeltaIdx + j] * learningRate * -1.0; // Bias update
            int prevLayerSize = hiddenLayers > 0 ? hidden : this.inputs;
            for (int k = 0; k < prevLayerSize; ++k) {
                weights[wIdx++] += deltas[outputDeltaIdx + j] * learningRate * outputNeurons[prevOutIdx + k];
            }
        }

        // Hidden Weights
        for (int h = hiddenLayers - 1; h >= 0; --h) {
             int dIndex = h * hidden;
             int iIndex = h > 0 ? (this.inputs + hidden * (h - 1)) : 0;
             int wIndex = h > 0 ? ((this.inputs + 1) * hidden + (hidden + 1) * hidden * (h - 1)) : 0;
             
             for (int j = 0; j < hidden; ++j) {
                 weights[wIndex++] += deltas[dIndex + j] * learningRate * -1.0;
                 int prevSize = (h == 0 ? this.inputs : hidden);
                 for (int k = 0; k < prevSize; ++k) {
                     weights[wIndex++] += deltas[dIndex + j] * learningRate * outputNeurons[iIndex + k];
                 }
             }
        }
    }
}