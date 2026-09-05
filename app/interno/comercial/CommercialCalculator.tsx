"use client";

import { useMemo, useState } from "react";
import styles from "./comercial.module.css";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function numberFrom(value: string) {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

export default function CommercialCalculator() {
  const [production, setProduction] = useState("");
  const [freight, setFreight] = useState("");
  const [other, setOther] = useState("");
  const [sale, setSale] = useState("");
  const [blinkoShare, setBlinkoShare] = useState("50");

  const result = useMemo(() => {
    const productionValue = numberFrom(production);
    const freightValue = numberFrom(freight);
    const otherValue = numberFrom(other);
    const saleValue = numberFrom(sale);
    const costs = productionValue + freightValue + otherValue;
    const margin = saleValue - costs;
    const pct = Math.min(100, Math.max(0, numberFrom(blinkoShare)));
    const blinko = margin > 0 ? margin * (pct / 100) : 0;
    const supplier = margin > 0 ? margin - blinko : 0;

    return { costs, margin, blinko, supplier };
  }, [production, freight, other, sale, blinkoShare]);

  return (
    <div className={styles.calculator}>
      <div className={styles.formGrid}>
        <label>
          <span>Custo de produção</span>
          <div className={styles.moneyInput}><b>R$</b><input inputMode="decimal" value={production} onChange={(e) => setProduction(e.target.value)} placeholder="0,00" /></div>
        </label>
        <label>
          <span>Frete / entrega</span>
          <div className={styles.moneyInput}><b>R$</b><input inputMode="decimal" value={freight} onChange={(e) => setFreight(e.target.value)} placeholder="0,00" /></div>
        </label>
        <label>
          <span>Outros custos</span>
          <div className={styles.moneyInput}><b>R$</b><input inputMode="decimal" value={other} onChange={(e) => setOther(e.target.value)} placeholder="0,00" /></div>
        </label>
        <label>
          <span>Preço de venda</span>
          <div className={styles.moneyInput}><b>R$</b><input inputMode="decimal" value={sale} onChange={(e) => setSale(e.target.value)} placeholder="0,00" /></div>
        </label>
        <label>
          <span>Participação Blinko na margem</span>
          <div className={styles.percentInput}><input inputMode="decimal" value={blinkoShare} onChange={(e) => setBlinkoShare(e.target.value)} /><b>%</b></div>
        </label>
      </div>

      <div className={styles.resultGrid}>
        <div><span>Custo total</span><strong>{money.format(result.costs)}</strong></div>
        <div><span>Margem disponível</span><strong data-negative={result.margin < 0 ? "true" : "false"}>{money.format(result.margin)}</strong></div>
        <div className={styles.highlight}><span>Parte Blinko</span><strong>{money.format(result.blinko)}</strong></div>
        <div><span>Parte fornecedor</span><strong>{money.format(result.supplier)}</strong></div>
      </div>
      <p className={styles.calculatorNote}>A divisão é aplicada sobre a margem depois dos custos. Nesta prévia, nenhum valor é salvo.</p>
    </div>
  );
}
