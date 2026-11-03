package br.forum.aquaml.analysis.domain;

import jakarta.persistence.Basic;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Lob;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.Optional;

@Entity
@Table(name = "analysis_runs")
public class AnalysisRun {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Instant startedAt;

    private Instant finishedAt;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private RunStatus status;

    private Double iqaMean;
    private Integer alertCount;
    private Double accuracy;

    @Column(length = 1000)
    private String error;

    @Lob
    @Basic(fetch = FetchType.LAZY)
    @Column(columnDefinition = "CLOB")
    private String resultJson;

    protected AnalysisRun() {
        // exigido pelo JPA
    }

    public static AnalysisRun start() {
        AnalysisRun run = new AnalysisRun();
        run.startedAt = Instant.now();
        run.status = RunStatus.EXECUTANDO;
        return run;
    }

    public void complete(AnalysisResult result) {
        requireRunning();
        this.resultJson = result.json();
        this.iqaMean = result.iqaMean();
        this.alertCount = result.alertCount();
        this.accuracy = result.accuracy();
        this.status = RunStatus.CONCLUIDA;
        this.finishedAt = Instant.now();
    }

    public void fail(String message) {
        requireRunning();
        this.error = message == null || message.isBlank() ? "A análise falhou." : message;
        this.status = RunStatus.FALHOU;
        this.finishedAt = Instant.now();
    }

    private void requireRunning() {
        if (status != RunStatus.EXECUTANDO) {
            throw new IllegalStateException("A execução já terminou.");
        }
    }

    public Optional<AnalysisResult> result() {
        return status == RunStatus.CONCLUIDA && resultJson != null
                ? Optional.of(AnalysisResult.fromJson(resultJson)) : Optional.empty();
    }

    public Long getId() {
        return id;
    }

    public Instant getStartedAt() {
        return startedAt;
    }

    public Instant getFinishedAt() {
        return finishedAt;
    }

    public RunStatus getStatus() {
        return status;
    }

    public Double getIqaMean() {
        return iqaMean;
    }

    public Integer getAlertCount() {
        return alertCount;
    }

    public Double getAccuracy() {
        return accuracy;
    }

    public String getError() {
        return error;
    }
}
