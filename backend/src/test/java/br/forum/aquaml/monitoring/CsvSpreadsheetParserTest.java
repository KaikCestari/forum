package br.forum.aquaml.monitoring;

import br.forum.aquaml.monitoring.application.CsvFormatException;
import br.forum.aquaml.monitoring.application.CsvSpreadsheetParser;
import br.forum.aquaml.monitoring.domain.StationType;
import org.junit.jupiter.api.Test;

import java.io.StringReader;
import java.time.LocalDate;
import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Leitura das planilhas CSV (formato internacional e formato brasileiro do Excel). */
class CsvSpreadsheetParserTest {

    @Test
    void readsInternationalFormat() {
        var p = CsvSpreadsheetParser.measurements(new StringReader("""
                timestamp,station_id,ph,do_mgl,temp_c,turbidity_ntu,conductivity_uscm,nitrate_mgl,phosphorus_mgl,coliforms_nmp
                2024-10-01T00:00:00,RIO-01,7.1594,8.6964,17.7525,2.8456,58.6615,0.2865,0.0115,
                2024-10-01T01:00:00,RIO-01,7.1648,8.5493,17.9710,2.7232,58.1292,0.2817,0.0116,18.2234
                """));
        assertEquals(2, p.measurements().size());
        assertTrue(p.missingParams().isEmpty());
        assertNull(p.measurements().get(0).getParameters().coliformsNmp());
        assertEquals(18.2234, p.measurements().get(1).getParameters().coliformsNmp());
        assertEquals(2.0, p.readingsPerDay());
    }

    @Test
    void readsBrazilianSpreadsheetExport() {
        var p = CsvSpreadsheetParser.measurements(new StringReader("""
                ﻿Data;Estação;pH;Oxigênio dissolvido (mg/L);Coliformes (NMP/100mL)
                10/03/2025 14:00;P1;6,8;1.234,5;<10
                2025-03-10 15:30:00;P1;7.2;;sem dado
                ;P1;7;7;7
                """));
        assertEquals(2, p.measurements().size());
        assertEquals(1, p.skippedRows());
        var m = p.measurements().get(0);
        assertEquals(LocalDateTime.of(2025, 3, 10, 14, 0), m.getTimestamp());
        assertEquals("P1", m.getStationId());
        assertEquals(6.8, m.getParameters().ph());
        assertEquals(1234.5, m.getParameters().doMgl());
        assertEquals(5.0, m.getParameters().coliformsNmp(), "abaixo do limite de detecção vira metade do limite");
        assertEquals(7.2, p.measurements().get(1).getParameters().ph(), "ponto decimal também vale com ;");
        assertNull(p.measurements().get(1).getParameters().coliformsNmp());
        assertTrue(p.missingParams().contains("temp_c"));
    }

    @Test
    void understandsUnitsInHeadersAndDetectionLimitWithDecimalComma() {
        var p = CsvSpreadsheetParser.measurements(new StringReader("""
                Data/Hora;Posto;OD (mg/L);Fósforo total (mg/L);Turbidez (NTU);Temperatura (°C)
                01/02/2026 08:00;Rio A;7,8;<0,02;12,5;22
                """));
        var params = p.measurements().get(0).getParameters();
        assertEquals(7.8, params.doMgl());
        assertEquals(0.01, params.phosphorusMgl(), 1e-9);
        assertEquals(12.5, params.turbidityNtu());
        assertEquals(22.0, params.tempC());
        assertEquals("Rio A", p.measurements().get(0).getStationId());
    }

    @Test
    void mapsStationTypes() {
        var s = CsvSpreadsheetParser.stations(new StringReader("""
                estacao,nome,tipo,latitude,longitude
                A,Represa Norte,Represa,-23.1,-46.5
                B,,Lagoa,,
                C,Foz,salobra,,
                """));
        assertEquals(StationType.RESERVATORIO, s.get(0).getType());
        assertEquals(-23.1, s.get(0).getLat());
        assertEquals("B", s.get(1).getName());
        assertEquals(StationType.LAGO, s.get(1).getType());
        assertEquals(StationType.ESTUARIO, s.get(2).getType());
    }

    @Test
    void readsEvents() {
        var e = CsvSpreadsheetParser.events(new StringReader("""
                estacao;inicio;fim;tipo;descricao
                rio-a;01/02/2026;04/02/2026;despejo;Despejo irregular
                rio-a;10/02/2026;;chuva;
                """));
        assertEquals(2, e.size());
        assertEquals(LocalDate.of(2026, 2, 4), e.get(0).getEndDate());
        assertEquals(LocalDate.of(2026, 2, 10), e.get(1).getEndDate(), "sem fim, o evento dura um dia");
    }

    @Test
    void rejectsFilesWithoutParameters() {
        var e = assertThrows(CsvFormatException.class, () -> CsvSpreadsheetParser.measurements(
                new StringReader("timestamp,station_id,foo\n2025-01-01T00:00,A,1\n")));
        assertTrue(e.getMessage().contains("parâmetro"));
    }

    @Test
    void rejectsMissingRequiredColumn() {
        var e = assertThrows(CsvFormatException.class, () -> CsvSpreadsheetParser.measurements(
                new StringReader("station_id,ph\nA,7\n")));
        assertTrue(e.getMessage().contains("Coluna obrigatória"));
    }
}
