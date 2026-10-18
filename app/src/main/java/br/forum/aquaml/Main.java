package br.forum.aquaml;

import io.javalin.Javalin;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.List;

/** Ponto de entrada do AquaML: sobe a API REST consumida pelo front-end React. */
public final class Main {

    private static final Logger log = LoggerFactory.getLogger(Main.class);

    private Main() {}

    public static Javalin createApp(ResultsRepository repo, PipelineService pipeline, List<String> corsOrigins) {
        Javalin app = Javalin.create(cfg -> {
            cfg.showJavalinBanner = false;
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
        ApiRoutes.register(app, repo, pipeline);
        return app;
    }

    public static void main(String[] args) throws Exception {
        AppConfig config = AppConfig.fromEnvironment();
        ResultsRepository repo = new ResultsRepository(config.resultsFile());
        PipelineService pipeline = new PipelineService(config, repo);

        if (repo.reload()) {
            log.info("Resultados carregados de {}", config.resultsFile());
        } else {
            log.info("Nenhum resultado encontrado; executando o pipeline completo");
            pipeline.start(false, null);
        }

        createApp(repo, pipeline, config.corsOrigins()).start(config.port());
        log.info("API do AquaML em http://localhost:{} (raiz: {}, CORS: {})",
                config.port(), config.root(), config.corsOrigins());
    }
}
