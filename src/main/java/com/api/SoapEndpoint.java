package com.ai.api;

import com.ai.repo.TrainingLogRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.ws.server.endpoint.annotation.*;
import org.w3c.dom.*;
import javax.xml.parsers.*;
import java.util.stream.Collectors;

// Manual simplified handling to avoid generating classes for this demo
@Endpoint
public class SoapEndpoint {
    private static final String NAMESPACE_URI = "http://ai.com/soap";

    @Autowired
    private TrainingLogRepository repo;

    @PayloadRoot(namespace = NAMESPACE_URI, localPart = "GetLogRequest")
    @ResponsePayload
    public Element getLogs() throws Exception {
        DocumentBuilderFactory dbf = DocumentBuilderFactory.newInstance();
        Document doc = dbf.newDocumentBuilder().newDocument();
        Element response = doc.createElementNS(NAMESPACE_URI, "GetLogResponse");

        repo.findAll().forEach(log -> {
            Element entry = doc.createElementNS(NAMESPACE_URI, "logEntry");
            entry.setTextContent("Epoch: " + log.getEpoch() + " | Time: " + log.getTimestamp());
            response.appendChild(entry);
        });

        return response;
    }
}