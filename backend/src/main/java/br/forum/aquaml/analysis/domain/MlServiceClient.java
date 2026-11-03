package br.forum.aquaml.analysis.domain;

/**
 * Porta para o serviço de machine learning (Python/FastAPI). O domínio só sabe que existe "alguém" que recebe os
 * dados e devolve um {@link AnalysisResult}; o HTTP fica na infraestrutura.
 */
public interface MlServiceClient {

    /**
     * @throws MlServiceException se o serviço estiver fora do ar ou recusar os dados
     */
    AnalysisResult analyze(AnalysisInput input);
}
