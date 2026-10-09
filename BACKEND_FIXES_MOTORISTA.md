# Especificação de Ajustes no Backend (CitMobi2) para o App Mobile do Motorista

Este documento descreve os problemas identificados na integração entre a API Spring Boot (`CitMobi2`) e o aplicativo mobile React Native (`CitMobiNative`), juntamente com as soluções recomendadas para a equipe/agente de backend.

---

## 1. Contexto do Problema

Quando o motorista (`ROLE_MOTORISTA`) realiza o login no aplicativo com seu CPF/matrícula e senha:
1. O login é autenticado com sucesso (`POST /v1/auth/login` retorna 200).
2. **Porém, a tela inicial do motorista fica sem dados** (exibe o CPF em vez do nome real e "Você não está vinculado a nenhum veículo nesse momento").
3. O aplicativo não consegue recuperar o **nome real do motorista**, o **veículo vinculado** e a **linha/rota de trabalho**.

---

## 2. Diagnóstico Técnico dos Gargalos
## Ignora essa merda a IA ta chapando, isso não importa, os dados vão vir do endpoint e não do JWT ignora essa porra, EU QUE ESTOU MANDANDO.
### Gargalo 1: O Token JWT não retorna Nome nem ID do Motorista
* **Arquivo:** `src/main/java/neo/com/br/CitMobi/services/TokenService.java`
* **Situação atual:** O método `generateToken(Usuario usuario)` insere apenas os seguintes claims:
  ```java
  JWT.create()
      .withIssuer("cit")
      .withSubject(usuario.getLogin()) // Apenas o CPF/login (ex: "52998224725")
      .withClaim("role", usuario.getRole().getRole())
      .withClaim("operador", usuario.getOperador() != null ? usuario.getOperador().getCnpj() : null)
      .withClaim("flagRegulador", flagRegulador)
      ...
  ```
* **Impacto:** O payload do token **não** possui o nome do usuário (`usuario.getNome()`) nem o seu UUID (`usuario.getId()`). O app fica apenas com a string crua do login/CPF.
## FODASE ISSO AQUI NÃO É IMPORTANTE A IA CHAPOU.
---

### Gargalo 2: Bloqueio 403 Forbidden para o Motorista consultar o próprio perfil
### ISSO É IMPORTANTE, O APLICATIVO NAO CONSEGUE TER ACESSO AOS DADOS PARA DISPONIBILIZAR NA TELA DO APLICATIVO.
* **Arquivos:**
  * `src/main/java/neo/com/br/CitMobi/controller/usuario/UsuarioController.java` (`@PreAuthorize("!hasRole('MOTORISTA')")`)
  * `src/main/java/neo/com/br/CitMobi/controller/motorista/MotoristaController.java` (`@PreAuthorize("!hasRole('MOTORISTA')")`)
* **Impacto:** Quando o app tenta contornar a falta de claims chamando `GET /v1/api/usuarios?login={cpf}`, o Spring Security bloqueia a requisição com **403 Forbidden**, pois a anotação na classe proíbe explicitamente usuários com `ROLE_MOTORISTA`.

---

### Gargalo 3: Rota `/v1/api/viagens/ativas` traz apenas status `EM_ANDAMENTO`
* **Arquivo:** `src/main/java/neo/com/br/CitMobi/services/ViagemService.java`
* **Situação atual:** O método `getViagensAtivas` filtra exclusivamente por `ViagemStatus.EM_ANDAMENTO`:
  ```java
  List<Viagem> ativas = viagemRepository.findByStatus(ViagemStatus.EM_ANDAMENTO);
  ```
* **Impacto:** Se o motorista acabou de iniciar seu turno e ainda **não clicou em iniciar viagem**, a viagem dele não está `EM_ANDAMENTO`. Ela ou está agendada/escala do dia (`VeiculoEscala` / `MotoristaHora`), ou ainda não foi criada. Portanto, a consulta retorna array vazio `[]`.

---

## 3. Alterações Necessárias no Backend

Recomendamos as seguintes implementações:

### A. Enriquecer o Token JWT ou a Resposta de Login

#### Opção 1 (Recomendada no Token JWT):
### FODA-SE A IA CHAPOU IGNORE ESSA MERDA.
### IGNORE TUDO RELACIONADO A JWT EM SI, OS DADOS NAO VAO VIR NO JWT VAO VIR NO ENDPOINT QUE O APLICATIVO TEM QUE CHAMAR PORRA DE AGENTE BURRO DO CARALHO
No arquivo `TokenService.java`:
```java
public String generateToken(Usuario usuario) {
    try {
        Algorithm algorithm = Algorithm.HMAC256(secret);
        String flagRegulador = (usuario.getOperador() != null && usuario.getOperador().getFlagRegulador() != null)
                ? usuario.getOperador().getFlagRegulador()
                : "N";

        return JWT.create()
                .withIssuer("cit")
                .withSubject(usuario.getLogin())
                .withClaim("id", usuario.getId() != null ? usuario.getId().toString() : null) // <-- NOVO
                .withClaim("nome", usuario.getNome())                                         // <-- NOVO
                .withClaim("role", usuario.getRole().getRole())
                .withClaim("operador", usuario.getOperador() != null ? usuario.getOperador().getCnpj() : null)
                .withClaim("flagRegulador", flagRegulador)
                .withExpiresAt(getExpirationDate())
                .sign(algorithm);
    } catch (JWTCreationException e) {
        throw new RuntimeException("Erro ao gerar token JWT", e);
    }
}
```

#### Opção 2 (No corpo da resposta de Login):
Atualizar o `LoginResponse` para devolver os dados resumidos do perfil:
```json
{
  "token": "...",
  "refreshToken": "...",
  "usuario": {
    "id": "00000000-0000-0000-0003-000000000007",
    "login": "52998224725",
    "nome": "LUCAS ALMEIDA",
    "role": "ROLE_MOTORISTA"
  }
}
```

---

### B. Endpoint de Perfil do Usuário Autenticado (`/v1/auth/me` ou `/v1/api/usuarios/me`)

Adicionar um endpoint acessível por qualquer usuário autenticado (incluindo `ROLE_MOTORISTA`):

```java
@GetMapping("/me")
@Operation(summary = "Retorna os dados do usuário autenticado atual")
public ResponseEntity<UsuarioRecord> getMe(@RequestHeader("Authorization") String authHeader) {
    String login = tokenService.getLoginFromToken(authHeader);
    return usuarioRepository.findFirstByLoginIgnoreCase(login)
            .map(u -> ResponseEntity.ok(usuarioService.toRecord(u)))
            .orElseGet(() -> ResponseEntity.status(HttpStatus.UNAUTHORIZED).build());
}
```

---

### C. Endpoint para Consulta da Escala / Vínculo Atual do Motorista

O aplicativo mobile precisa de um endpoint simples para saber qual é o veículo e linha atribuídos ao motorista no momento:

#### Sugestão de Endpoint:
`GET /v1/api/viagens/motorista/atual` ou `GET /v1/api/motoristas/me/vinculo`

**Permissão:** Aberto para `ROLE_MOTORISTA`.

**Lógica esperada:**
1. Extrai o motorista logado a partir do token (`authHeader`).
2. Verifica se já existe uma viagem `EM_ANDAMENTO` para esse motorista.
3. Se não houver viagem em andamento, busca a escala do dia (`VeiculoEscala` / `MotoristaHora`) associada a ele.
4. Retorna as informações necessárias para preencher o card e iniciar o rastreamento:

**Estrutura de Retorno (JSON):**
```json
{
  "status": "200",
  "message": "Vínculo obtido com sucesso",
  "data": {
    "motoristaId": "00000000-0000-0000-0003-000000000007",
    "motoristaNome": "LUCAS ALMEIDA",
    "hasViagemAtiva": false,
    "viagemId": null,
    "veiculoId": 12,
    "veiculoCodigo": "1002",
    "veiculoPlaca": "ABC1D23",
    "linhaId": 5,
    "linhaCodigo": "500",
    "linhaDescricao": "Terminal Central - Bairro Norte",
    "rotaId": 8,
    "sentido": "IDA"
  }
}
```

Caso o motorista realmente não tenha escala/veículo definido no momento:
```json
{
  "status": "200",
  "message": "Nenhum vínculo ou viagem encontrada para o motorista",
  "data": null
}
```

---

## 4. Resumo das Tarefas para o Agente de Backend

- [ ] **1. `TokenService.java`**: Adicionar claims `"id"` e `"nome"` no token JWT gerado em `generateToken`.
- [ ] **2. `AuthController.java` ou `UsuarioController.java`**: Disponibilizar endpoint `GET /v1/auth/me` (ou liberar consulta de perfil próprio) sem bloqueio para `ROLE_MOTORISTA`.
- [ ] **3. `ViagemController.java` / `ViagemService.java`**: Criar endpoint `GET /v1/api/viagens/motorista/atual` que retorna os dados do veículo/linha atribuídos ao motorista autenticado (seja viagem em andamento ou escala ativa).
