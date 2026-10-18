package br.forum.aquaml;

import io.javalin.Javalin;
import io.javalin.http.staticfiles.Location;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/** Ponto de entrada do AquaML: sobe a API e o painel web. */
public final class Main {

    private static final Logger log = LoggerFactory.getLogger(Main.class);

    private Main() {}

    public static Javalin createApp(ResultsRepository repo, PipelineService pipeline) {
        Javalin app = Javalin.create(cfg -> {
            cfg.staticFiles.add("/static", Location.CLASSPATH);
            cfg.showJavalinBanner = false;
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

        createApp(repo, pipeline).start(config.port());
        log.info("AquaML disponível em http://localhost:{} (raiz: {})", config.port(), config.root());
    }
}
