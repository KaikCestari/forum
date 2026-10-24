package br.forum.aquaml;

/** Mensagens públicas fixas. Diagnósticos e exceções ficam nos logs do servidor. */
final class PublicErrors {
    static final String INTERNAL = "Não foi possível concluir a solicitação. Tente novamente em alguns instantes.";
    static final String ASSISTANT = "O assistente está indisponível no momento. Tente novamente em alguns instantes.";
    static final String IMAGE = "Não foi possível analisar a imagem. Preencha à mão ou envie de novo.";
    static final String ANALYSIS = "Não foi possível concluir a análise. Tente novamente em alguns instantes.";

    private PublicErrors() {}
}
