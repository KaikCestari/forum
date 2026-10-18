package br.forum.aquaml;

import io.javalin.Javalin;
import io.javalin.config.SizeUnit;
import io.javalin.http.staticfiles.Location;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.Optional;

/** Ponto de entrada do AquaML: abre o banco H2, sobe a API e o painel web. */
public final class Main {

    private static final Logger log = LoggerFactory.getLogger(Main.class);

    private Main() {}

    public static Javalin createApp(ResultsRepository repo, PipelineService pipeline, Database db,
                                    AssistantService assistant) {
        Javalin app = Javalin.create(cfg -> {
            cfg.staticFiles.add("/static", Location.CLASSPATH);
            cfg.showJavalinBanner = false;
            cfg.jetty.multipartConfig.maxFileSize(200, SizeUnit.MB);
            cfg.jetty.multipartConfig.maxInMemoryFileSize(10, SizeUnit.MB);
            cfg.jetty.multipartConfig.maxTotalRequestSize(400, SizeUnit.MB);
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

        createApp(repo, pipeline, db, assistant).start(config.port());
        LlamaClient.Status llamaStatus = llama.status();
        log.info("Llama ({} em {}): {}", config.llamaModel(), config.ollamaUrl(),
                llamaStatus.modelInstalled() ? "disponível" : llamaStatus.error());
        log.info("AquaML disponível em http://localhost:{} (raiz: {})", config.port(), config.root());
    }
}
