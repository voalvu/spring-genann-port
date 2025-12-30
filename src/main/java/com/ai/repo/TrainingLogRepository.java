package com.ai.repo;
import com.ai.entity.TrainingLog;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TrainingLogRepository extends JpaRepository<TrainingLog, Long> {}