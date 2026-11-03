package br.forum.aquaml.monitoring.infrastructure.seed;

import br.forum.aquaml.analysis.application.AnalysisService;
import br.forum.aquaml.monitoring.application.DataImportService;
import br.forum.aquaml.monitoring.application.DataImportService.ImportCommand;
import br.forum.aquaml.monitoring.application.DataService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

import java.io.InputStream;
import java.util.zip.GZIPInputStream;

@Component
public class SampleDataSeeder implements ApplicationRunner {

    static final String DATASET_NAME = "Dados de exemplo (6 estações, 2 anos)";
    private static final Logger log = LoggerFactory.getLogger(SampleDataSeeder.class);
    private static final int TENTATIVAS = 30;
    private static final long INTERVALO_MS = 10_000;

    private final DataService data;
    private final DataImportService importer;
    private final AnalysisService analysis;
    private final boolean enabled;

    public SampleDataSeeder(DataService data, DataImportService importer, AnalysisService analysis,
                            @Value("${aquaml.sample-data:true}") boolean enabled) {
        this.data = data;
        this.importer = importer;
        this.analysis = analysis;
        this.enabled = enabled;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (!enabled) {
            return;
        }
        Thread worker = new Thread(this::seed, "aquaml-dados-exemplo");
        worker.setDaemon(true);
        worker.start();
    }

    void seed() {
        try {
            if (data.summary().measurements() > 0) {
                return;
            }
            log.info("Banco sem leituras: importando os dados de exemplo.");
            try (InputStream measurements = new GZIPInputStream(open("measurements.csv.gz"));
                 InputStream stations = open("stations.csv");
                 InputStream events = open("events.csv")) {
                importer.importData(new ImportCommand(measurements, "measurements.csv", stations, events,
                        DATASET_NAME));
            }
            ensureAnalysis();
        } catch (Exception e) {
            log.warn("Não foi possível carregar os dados de exemplo: {}", e.getMessage());
        }
    }

    private void ensureAnalysis() throws InterruptedException {
        for (int i = 1; analysis.lastCompletedRun().isEmpty() && i <= TENTATIVAS; i++) {
            log.info("Aguardando o serviço de ML para analisar os dados de exemplo ({}/{}).", i, TENTATIVAS);
            Thread.sleep(INTERVALO_MS);
            analysis.run();
        }
        analysis.lastCompletedRun().ifPresentOrElse(
                r -> log.info("Dados de exemplo prontos: análise {} concluída.", r.getId()),
                () -> log.warn("O serviço de ML não respondeu; rode a análise pela tela Dados quando ele subir."));
    }

    private static InputStream open(String name) throws java.io.IOException {
        return new ClassPathResource("exemplo/" + name).getInputStream();
    }
}
