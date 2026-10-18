package br.forum.aquaml;

import org.junit.jupiter.api.Test;

import java.io.StringReader;
import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.*;

class CsvImportTest {

    @Test
    void readsGeneratorFormat() throws Exception {
        var p = CsvImport.measurements(new StringReader("""
                timestamp,station_id,ph,do_mgl,temp_c,turbidity_ntu,conductivity_uscm,nitrate_mgl,phosphorus_mgl,coliforms_nmp
                2024-10-01T00:00:00,RIO-01,7.1594,8.6964,17.7525,2.8456,58.6615,0.2865,0.0115,
                2024-10-01T01:00:00,RIO-01,7.1648,8.5493,17.9710,2.7232,58.1292,0.2817,0.0116,18.2234
                """));
        assertEquals(2, p.measurements().size());
        assertTrue(p.missingParams().isEmpty());
        assertNull(p.measurements().get(0).values()[7]);
        assertEquals(18.2234, p.measurements().get(1).values()[7]);
    }

    @Test
    void readsBrazilianSpreadsheetExport() throws Exception {
        var p = CsvImport.measurements(new StringReader("""
                ﻿Data;Estação;pH;Oxigênio dissolvido (mg/L);Coliformes (NMP/100mL)
                10/03/2025 14:00;P1;6,8;1.234,5;<10
                2025-03-10 15:30:00;P1;7.2;;sem dado
                ;P1;7;7;7
                """));
        assertEquals(2, p.measurements().size());
        assertEquals(1, p.skippedRows());
        var m = p.measurements().get(0);
        assertEquals(LocalDateTime.of(2025, 3, 10, 14, 0), m.time());
        assertEquals(6.8, m.values()[0]);
        assertEquals(1234.5, m.values()[1]);
        assertEquals(5.0, m.values()[7], "abaixo do limite de detecção vira metade do limite");
        assertEquals(7.2, p.measurements().get(1).values()[0], "ponto decimal também vale com ;");
        assertNull(p.measurements().get(1).values()[7]);
        assertTrue(p.missingParams().contains("temp_c"));
    }

    @Test
    void mapsStationTypes() throws Exception {
        var s = CsvImport.stations(new StringReader("""
                estacao,nome,tipo,latitude,longitude
                A,Represa Norte,Represa,-23.1,-46.5
                B,,Lagoa,,
                C,Foz,salobra,,
                """));
        assertEquals("reservatorio", s.get(0).type());
        assertEquals(-23.1, s.get(0).lat());
        assertEquals("B", s.get(1).name());
        assertEquals("lago", s.get(1).type());
        assertEquals("estuario", s.get(2).type());
    }

    @Test
    void rejectsFilesWithoutParameters() {
        var e = assertThrows(CsvImport.ImportException.class, () -> CsvImport.measurements(
                new StringReader("timestamp,station_id,foo\n2025-01-01T00:00,A,1\n")));
        assertTrue(e.getMessage().contains("parâmetro"));
    }
}
