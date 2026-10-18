package br.forum.aquaml;

import io.javalin.Javalin;
import io.javalin.config.SizeUnit;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.List;
import java.util.Optional;

/** Ponto de entrada do AquaML: abre o banco H2 e sobe a API REST consumida pelo front-end React. */
public final class Main {

    private static final Logger log = LoggerFactory.getLogger(Main.class);

    private Main() {}

    public static Javalin createApp(ResultsRepository repo, PipelineService pipeline, Database db,
                                    AssistantService assistant, List<String> corsOrigins) {
        Javalin app = Javalin.create(cfg -> {
            cfg.showJavalinBanner = false;
            cfg.jetty.multipartConfig.maxFileSize(200, SizeUnit.MB);
            cfg.jetty.multipartConfig.maxInMemoryFileSize(10, SizeUnit.MB);
            cfg.jetty.multipartConfig.maxTotalRequestSize(400, SizeUnit.MB);
            if (!corsOrigins.isEmpty()) {
                cfg.bundledPlugins.enableCors(cors -> cors.addRule(rule -> {
                    if (corsOrigins.contains("*")) {
                        rule.anyHost();
                    } else {
                        corsOrigins.forEach(rule::allowHost);
                    }
                }));
            }
        });
        ApiRoutes.register(app, repo, pipeline, db, assistant);
        return app;
    }

    public static void main(String[] args) throws Exception {
        AppConfig config = AppConfig.fromEnvironment();
        Database db = new Database(config.dbUrl());
        ResultsRepository repo = new ResultsRepository(config.resultsFile());
        PipelineService pipeline = new PipelineService(config, repo, db);
        LlamaClient llama = new LlamaClient(config.ollamaUrl(), config.llamaModel());
        AssistantService assistant = new AssistantService(llama, repo, db);

        Optional<String> stored = db.latestResults();
        if (stored.isPresent()) {
            repo.load(stored.get());
            log.info("Última análise carregada do H2 ({})", config.dbUrl());
        } else {
            log.info("Nenhuma análise no H2; executando o pipeline completo");
            pipeline.start(false, null);
        }

        createApp(repo, pipeline, db, assistant, config.corsOrigins()).start(config.port());
        LlamaClient.Status llamaStatus = llama.status();
        log.info("Llama ({} em {}): {}", config.llamaModel(), config.ollamaUrl(),
                llamaStatus.modelInstalled() ? "disponível" : llamaStatus.error());
        log.info("API do AquaML em http://localhost:{} (raiz: {}, CORS: {})",
                config.port(), config.root(), config.corsOrigins());
    }
}
