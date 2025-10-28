

# Maandag Multi-Agent Workflow

Een TypeScript-workflow die de **chatbots van Maandag.com** orkestreert binnen de OpenAI Agent Builder-omgeving.
De workflow bepaalt met welke doelgroep de gebruiker te maken heeft — kandidaat, opdrachtgever of professional —
en schakelt vervolgens de juiste agent in (zoals **Ziggy Zorg**, **Olga Overheid** of **Figo Finance**).

---

## Functionaliteit

De workflow:

* Classificeert automatisch de gebruiker (`user_type`) op basis van intentie of context.
* Leidt bestaande opdrachtgevers naar de juiste accountmanager per domein:

  * **Zorg** → Ziggy Zorg
  * **Overheid** → Olga Overheid
  * **Finance** → Figo Finance
* Stelt verduidelijkende vragen via een **Clarifier-agent** als de intentie onduidelijk is.
* Behoudt de conversatiegeschiedenis zodat context niet verloren gaat.

De logica is gedefinieerd in [`runWorkflow.ts`](./runWorkflow.ts).
Agents worden geïnitialiseerd met duidelijke instructies, persona’s en verificatieregels.

---

## Structuur

```
multi-agent-maandag/
├── runWorkflow.ts        # De volledige multi-agent workflow
├── package.json          # Dependencies en scripts
├── .env.example          # Voorbeeld van vereiste omgevingvariabelen
├── .gitignore            # Sluit lokale .env uit
└── README.md             # Deze uitleg
```

---

## Lokaal uitvoeren

1. **Kloon de repo**

   ```bash
   git clone https://github.com/bakkerlisenkacj-glitch/multi-agent-maandag.git
   cd multi-agent-maandag
   ```

2. **Installeer dependencies**

   ```bash
   npm install
   ```

3. **Maak een .env-bestand aan**

   ```bash
   cp .env.example .env
   ```

   Vul je eigen OpenAI API-sleutel in bij:

   ```
   OPENAI_API_KEY=sk-...
   ```

4. **Run de workflow**

   ```bash
   npm run start
   ```

   *(of gebruik de code direct binnen OpenAI Agent Builder)*

---

## Veiligheid

* De echte `.env` is **uitgesloten via `.gitignore`**
* Alleen `.env.example` staat in de repo als referentie
* Nooit echte API-keys uploaden of delen

---

## Over dit project

Deze workflow is gebouwd als **casus voor Maandag.com**,
met de nadruk op semantische classificatie, domeinrouting en persona-consistentie.
De opzet toont hoe meerdere agents kunnen samenwerken binnen één gestructureerde logica.

---

© 2025 — Lisenka Bakker
*“De logica mag complex zijn, de ervaring moet menselijk blijven.”*


