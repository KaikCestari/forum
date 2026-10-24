/** Requer agent-browser da Vercel, API real em 7070 e Vite em 5173. */
const { execFileSync } = require("node:child_process");
const { mkdtempSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const assert = require("node:assert/strict");

const cli = process.env.AQUAML_AGENT_BROWSER_BIN || "agent-browser";
const base = process.env.AQUAML_WEB_URL || "http://localhost:5173";
const session = execFileSync(
  cli,
  ["session", "id", "--scope", "worktree", "--prefix", "aquaml-auth-check"],
  { encoding: "utf8" },
).trim();
const artifacts = mkdtempSync(join(tmpdir(), "aquaml-auth-browser-"));
const email = `qa-${Date.now()}@example.test`;
const password = "Uma frase de teste AquaML 2026!";
const prefix = ["--session", session, "--namespace", "aquaml-auth-qa"];
const run = (...args) =>
  execFileSync(cli, [...prefix, ...args], {
    encoding: "utf8",
    timeout: 35000,
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
const evaluate = (expression) => {
  const output = JSON.parse(run("--json", "eval", expression));
  assert.equal(output.success, true, output.error);
  return output.data.result;
};
const snapshot = () => run("snapshot", "-i");
const ref = (role, name) => {
  const line = snapshot()
    .split("\n")
    .find((line) => line.trimStart().startsWith(`- ${role} "${name}"`));
  assert.ok(line, `Elemento ausente: ${role} ${name}`);
  const match = line.match(/ref=(e\d+)/);
  assert.ok(match, `Referência ausente: ${line}`);
  return `@${match[1]}`;
};
const click = (role, name) => run("click", ref(role, name));
const fill = (name, value) => run("fill", ref("textbox", name), value);
const waitText = (text) => run("wait", "--text", text);
const assertUrl = (path) =>
  assert.equal(new URL(run("get", "url")).pathname, path);
const screenshot = (name) =>
  run("screenshot", "--full", join(artifacts, `${name}.png`));
const noOverflow = () =>
  assert.equal(
    evaluate("document.documentElement.scrollWidth <= window.innerWidth"),
    true,
  );

try {
  run("set", "viewport", "1440", "1000");
  run("open", `${base}/dados?aba=importar`);
  waitText("Bom ter você de volta");
  assertUrl("/login");
  assert.equal(
    new URL(run("get", "url")).searchParams.get("retorno"),
    "/dados?aba=importar",
  );
  noOverflow();
  screenshot("login-desktop");
  console.log(
    "PASS: visitante é redirecionado ao login com destino preservado.",
  );

  click("link", "Criar conta");
  waitText("Crie sua conta");
  screenshot("cadastro-desktop");
  fill("Nome completo", "Pessoa de teste AquaML");
  fill("E-mail", "invalido");
  assert.equal(
    evaluate("document.querySelector('#auth-email').validity.valid"),
    false,
  );
  fill("E-mail", email);
  fill("Senha", password);
  fill("Confirme a senha", "outra frase de teste");
  click("button", "Criar conta");
  waitText("As senhas não coincidem");
  fill("Confirme a senha", password);
  click("button", "Criar conta");
  waitText("Importar planilha de sensores");
  assertUrl("/dados");
  assert.equal(new URL(run("get", "url")).searchParams.get("aba"), "importar");
  assert.ok(
    evaluate("document.querySelector('.account-details').textContent").includes(
      email,
    ),
  );
  run("reload");
  waitText("Importar planilha de sensores");
  assertUrl("/dados");
  console.log(
    "PASS: cadastro real, validação de e-mail/senhas, entrada automática e sessão após recarga.",
  );

  // Confere cookies sem imprimir seu conteúdo ou tokens.
  assert.equal(evaluate("document.cookie.includes('aquaml_session')"), false);
  assert.equal(evaluate("localStorage.length"), 0);
  const allowed = evaluate(
    "(async () => (await fetch('/api/points')).status)()",
  );
  assert.equal(allowed, 200);
  const noCsrf = evaluate(
    "(async () => (await fetch('/api/auth/logout', {method:'POST'})).status)()",
  );
  assert.equal(noCsrf, 403);
  click("button", "Sair da conta");
  waitText("Bom ter você de volta");
  const denied = evaluate(
    "(async () => (await fetch('/api/points')).status)()",
  );
  assert.equal(denied, 401);
  run("open", `${base}/relatorio`);
  waitText("Bom ter você de volta");
  assertUrl("/login");
  console.log(
    "PASS: cookie HttpOnly, API protegida, CSRF obrigatório e logout revoga acesso.",
  );

  fill("E-mail", email);
  fill("Senha", "senha errada 123");
  click("button", "Entrar");
  waitText("E-mail ou senha incorretos");
  assertUrl("/login");
  fill("Senha", password);
  click("button", "Mostrar senha");
  assert.equal(
    evaluate("document.querySelector('#auth-password').type"),
    "text",
  );
  click("button", "Ocultar senha");
  run("check", ref("checkbox", "Manter conectado por 30 dias"));
  click("button", "Entrar");
  waitText("Relatório da bacia");
  assertUrl("/relatorio");
  console.log(
    "PASS: senha incorreta, mostrar/ocultar senha e login com opção de manter conectado.",
  );

  // Uma alteração real também confere que o cliente envia cookie + CSRF.
  const note = evaluate(
    "(async () => { const s = await (await fetch('/api/auth/session')).json(); const r = await fetch('/api/notes', {method:'POST', headers:{'Content-Type':'application/json','X-CSRF-Token':s.csrfToken}, body:JSON.stringify({station_id:'qa-auth',date:new Date().toISOString().slice(0,10),kind:'observacao',text:'Verificação isolada de autenticação.'})}); return {status:r.status,id:(await r.json()).id}; })()",
  );
  assert.equal(note.status, 201);
  const deleted = evaluate(
    `(async () => { const s = await (await fetch('/api/auth/session')).json(); return (await fetch('/api/notes/${note.id}', {method:'DELETE',headers:{'X-CSRF-Token':s.csrfToken}})).status; })()`,
  );
  assert.equal(deleted, 204);

  run("tab", "new", `${base}/`);
  waitText("Visão geral");
  run("tab", "t1");
  click("button", "Sair da conta");
  waitText("Bom ter você de volta");
  run("tab", "t2");
  waitText("Bom ter você de volta");
  assertUrl("/login");
  console.log("PASS: escrita autenticada e logout sincronizado entre abas.");

  run("open", `${base}/cadastro`);
  waitText("Crie sua conta");
  fill("Nome completo", "Pessoa duplicada");
  fill("E-mail", email);
  fill("Senha", password);
  fill("Confirme a senha", password);
  click("button", "Criar conta");
  waitText("Este e-mail já está cadastrado");
  console.log("PASS: cadastro duplicado rejeitado pelo backend.");

  for (const width of [390, 320]) {
    run("set", "viewport", String(width), "844");
    for (const route of ["login", "cadastro"]) {
      run("open", `${base}/${route}`);
      waitText(route === "login" ? "Bom ter você de volta" : "Crie sua conta");
      noOverflow();
      screenshot(`${route}-mobile-${width}`);
    }
  }
  console.log("PASS: login e cadastro responsivos em 320 e 390 px.");
  const errors = run("errors");
  assert.ok(
    !errors || /no errors/i.test(errors),
    `Erros de execução: ${errors}`,
  );
  console.log(
    `Agent-browser da Vercel: todos os fluxos passaram com API real. Capturas: ${artifacts}`,
  );
} finally {
  try {
    run("close");
  } catch {
    /* a falha original deve continuar visível */
  }
}
