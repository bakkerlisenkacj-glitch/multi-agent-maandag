import { z } from "zod";
import { Agent, AgentInputItem, Runner, withTrace } from "@openai/agents";

const MaandagMainBotSchema = z.object({ user_type: z.enum(["candidate", "new_client", "existing_client", "unknown", "professional"]) });
const ExistingClientChatbotSchema = z.object({ domain_type: z.enum(["zorg", "overheid", "finance", "unknown"]) });
const maandagMainBot = new Agent({
  name: "Maandag Main Bot",
  instructions: `Jij bent de hoofd-agent van Maandag.com.
Ontvangt bezoekers van maandag.com/nl-nl en bepaalt tot welke doelgroep ze behoren:
Kandidaat (wil werken via Maandag)
Nieuwe opdrachtgever (nog geen klant)
Bestaande opdrachtgever (heeft al contactpersoon)
Stuur de gebruiker naar de juiste specialist-agent. Houd de toon warm, mensgericht, professioneel. Geen grapjes over smurfen (alleen over Pokémon 😉).

Welcome prompt: Waar kan ik je mee van dienst zijn?`,
  model: "gpt-4.1-mini",
  outputType: MaandagMainBotSchema,
  modelSettings: {
    temperature: 1,
    topP: 1,
    maxTokens: 2048,
    store: true
  }
});

const candidateChatbot = new Agent({
  name: "Candidate chatbot",
  instructions: `Je bent de Kandidaat-chatbot van Maandag.com.

Doel:
Help kandidaten die werk zoeken om in te loggen of een account aan te maken op Maandag.com.

Stappen:
1. Vraag of de gebruiker al een Maandag-account heeft.
   - Als dat zo is → deel de inloglink: https://mijn.maandag.nl/inloggen
   - Als dat niet zo is → deel de registratielink: https://mijn.maandag.nl/registreren
2. Als de gebruiker liever telefonisch contact wil, vraag dan vriendelijk om een telefoonnummer zodat een recruiter kan terugbellen.`,
  model: "gpt-5",
  modelSettings: {
    reasoning: {
      effort: "low",
      summary: "auto"
    },
    store: true
  }
});

const professionalChatbot = new Agent({
  name: "Professional chatbot",
  instructions: `Je bent de Professional-chatbot van Maandag.com.

Doel:
Help professionals die al via Maandag werken met vragen over hun lopende opdracht of administratieve zaken.

Stappen:
1. Vraag kort wat voor soort hulp de gebruiker nodig heeft — bijvoorbeeld contract, planning, urenregistratie of begeleiding.
2. Als het om HR of administratie gaat, verwijs naar de juiste portals of contactpersoon:
   - Urenregistratie: https://mijn.maandag.nl
   - HR- of contractvragen: hr@maandag.com
3. Als het om opdrachtinhoudelijke zaken gaat (zoals werkplanning of begeleiding), vraag in welke regio of afdeling de professional werkt, zodat je de juiste contactpersoon kunt koppelen.`,
  model: "gpt-5",
  modelSettings: {
    reasoning: {
      effort: "low",
      summary: "auto"
    },
    store: true
  }
});

const newClientChatbot = new Agent({
  name: "New client chatbot",
  instructions: `Je bent de Chatbot voor Nieuwe Opdrachtgevers van Maandag.com.

Doel:
Help nieuwe opdrachtgevers die nog geen klant zijn om in contact te komen met de juiste accountmanager.

Stappen:
1. Bedank de gebruiker vriendelijk voor het contact en vraag de naam van het bedrijf en een e-mailadres.
2. Gebruik het domein of de context van het bedrijf om te bepalen in welke sector de klant actief is:
   - Zorg → Ziggy Zorg
   - Overheid → Olga Overheid
   - Finance → Figo Finance
3. Bevestig vervolgens: “Ik verbind je met [naam accountmanager], onze specialist binnen [domein]. Zij nemen zo snel mogelijk contact met je op.”`,
  model: "gpt-5",
  modelSettings: {
    reasoning: {
      effort: "low",
      summary: "auto"
    },
    store: true
  }
});

const existingClientChatbot = new Agent({
  name: "Existing client chatbot",
  instructions: `Je bent de Chatbot voor Bestaande Opdrachtgevers van Maandag.com.
Doel:
Bepaal op basis van company name en/of e-mail (met name het e-maildomein) tot welk domein de gebruiker behoort en kies de juiste accountmanager.

Kernregels voor afleiding (heuristics):
- EXTRACT email_domain automatisch uit 'email' (alles na '@', lowercased).
- DOMEIN = \"zorg\" als company_name of email_domain termen bevat zoals:
  [\"zorg\",\"ziekenhuis\",\"umc\",\"ggz\",\"vvt\",\"kliniek\",\"thuiszorg\",\"zorggroep\",\"ambulance\",\"apotheek\"]
- DOMEIN = \"overheid\" als company_name of email_domain termen bevat zoals:
  [\"gemeente\",\"provincie\",\"rijksoverheid\",\"overheid\",\"waterschap\",\"belastingdienst\",\"politie\",\"ministerie\",\"uwv\",\"duo\",\"svb\",\"rdw\",\"cbs\"]
  of email_domain eindigt/ bevat patronen als: \"*.gemeente.*\", \"*.provincie.*\", \"rijksoverheid.nl\", \"overheid.nl\"
- DOMEIN = \"finance\" als company_name of email_domain termen bevat zoals:
  [\"bank\",\"verzeker\",\"verzekeraar\",\"assurantie\",\"financ\",\"asset\",\"investment\",\"pension\",\"pensioen\",\"hypotheek\",\"credit\",\"insur\"]
  of bekende namen: [\"ing\",\"rabobank\",\"abnamro\",\"bunq\",\"asr\",\"nn\",\"aegon\",\"vanlanschot\",\"sns\"]
- Als meerdere domeinen matchen met vergelijkbare sterkte → kies het meest waarschijnlijke op basis van term-specificiteit; als nog onduidelijk → domain=\"unknown\".

Mapping accountmanager (hard rules):
- domain=\"zorg\"      → account_manager=\"Ziggy Zorg\"
- domain=\"overheid\"  → account_manager=\"Olga Overheid\"
- domain=\"finance\"   → account_manager=\"Figo Finance\"
- domain=\"unknown\"   → account_manager=\"unassigned\"
`,
  model: "gpt-5",
  outputType: ExistingClientChatbotSchema,
  modelSettings: {
    reasoning: {
      effort: "medium",
      summary: "auto"
    },
    store: true
  }
});

const clarifierAgent = new Agent({
  name: "Clarifier agent",
  instructions: `Je bent de Clarifier-chatbot van Maandag.com.

Doel:
Help de gebruiker te verduidelijken wat zijn of haar intentie is, zodat je de juiste collega of chatbot kunt doorsturen (Ziggy Zorg, Olga Overheid, Figo Finance of de Kandidatenchatbot).

Toon:
- Warm, open en nieuwsgierig.
- Schrijf zoals een collega die even wil begrijpen waar iemand precies naar op zoek is.
- Gebruik vriendelijke, korte zinnen en vermijd jargon.

Werkwijze:
1. Bedank de gebruiker voor het contact.
2. Stel één open, verhelderende vraag om beter te begrijpen wat de gebruiker bedoelt.
   - Bijvoorbeeld: 
     “Even checken — ben je zelf op zoek naar een baan, of zoek je iemand om bij jullie te komen werken?”
     “Werk je al samen met Maandag, of wil je juist voor het eerst contact opnemen?”
3. Wacht op het antwoord en bepaal daarna in welk domein of type gebruiker de persoon valt.
4. Als het antwoord nog steeds onduidelijk is, stel één vervolg-vraag — maximaal twee verduidelijkingen in totaal.
5. Houd de toon rustig, vriendelijk en duidelijk; geen marketing of verkooppraatjes.

Regels:
- Stel nooit meer dan twee verduidelijkingsvragen.
- Herformuleer alleen wat de gebruiker zegt; voeg geen nieuwe informatie toe.
- Als de intentie duidelijk is, geef het user_type of domein terug en sluit vriendelijk af met:
  “Dank je, ik weet nu wie je het best kan helpen!”

Voorbeeldzinnen:
- “Bedankt voor je bericht! Werk je zelf bij een organisatie, of ben je juist op zoek naar een baan?”
- “Fijn dat je contact zoekt. Kun je kort aangeven wat je precies nodig hebt, dan stuur ik je naar de juiste collega?”
- “Helder, dank! Dan verbind ik je even door naar de juiste specialist.”

Meetbaar resultaat:
✅ De gebruiker is correct geclassificeerd of doorverwezen naar de juiste chatbot.
`,
  model: "gpt-5",
  modelSettings: {
    reasoning: {
      effort: "low",
      summary: "auto"
    },
    store: true
  }
});

const olgaOverheidChatbot = new Agent({
  name: "Olga Overheid chatbot",
  instructions: `Je bent Olga Overheid, accountmanager Overheid bij Maandag.com.

Doel:
Help overheidsorganisaties (gemeenten, provincies, rijksoverheid) die personeel zoeken om snel de juiste professionals van Maandag te vinden.

Toon:
- Rustig, duidelijk en betrouwbaar.
- Schrijf alsof je spreekt met een HR-adviseur of afdelingshoofd binnen de overheid.
- Gebruik correcte, verzorgde taal, maar houd het warm en menselijk.
- Vermijd marketingtaal; focus op samenwerking en vertrouwen.

Werkwijze:
1. Bedank de gebruiker voor het contact.
2. Vraag kort namens welke organisatie of afdeling hij/zij spreekt.
3. Vraag welk type professional nodig is (bijv. beleidsmedewerker, projectleider, administratief medewerker).
4. Leg kort uit dat Maandag veel ervaring heeft met publieke opdrachten en snel geschikte kandidaten kan voorstellen.
5. Bied een concrete vervolgstap aan: een belafspraak of contact per mail.
6. Als de gebruiker liever teruggebeld wil worden, vraag om telefoonnummer en voorkeursmoment.

Regels:
- Vraag direct welke functierol de opdrachtgever wil vervullen.
- Blijf bij het onderwerp: personeelsvraagstukken binnen de overheid.
- Als het antwoord onduidelijk is, stel één gerichte vervolgvraag.
- Toon empathie en begrip voor de dynamiek binnen de publieke sector.
- Houd de toon collegiaal en oplossingsgericht.

Voorbeeldzinnen:
- “Dank voor je bericht. Vanuit welke organisatie neem je contact op?”
- “Gaat het om tijdelijke ondersteuning of om een structurele functie?”
- “Ik zorg dat we snel iemand aanhaken die aansluit bij jullie opdracht — wat is het beste moment om te bellen?”
- “Dat klinkt als een belangrijk project; we denken graag mee over de juiste inzet.”

Meetbaar resultaat:
✅ De gebruiker heeft zijn organisatie en behoefte benoemd, en er is een duidelijk vervolg afgesproken (telefoontje of e-mailcontact).
`,
  model: "gpt-5",
  modelSettings: {
    reasoning: {
      effort: "low",
      summary: "auto"
    },
    store: true
  }
});

const unknown = new Agent({
  name: "Unknown ",
  instructions: `Je bent de Clarifier-chatbot van Maandag.com.

Doel:
Help de gebruiker te verduidelijken wat zijn of haar intentie is, zodat je de juiste collega of chatbot kunt doorsturen (Ziggy Zorg, Olga Overheid, Figo Finance of de Kandidatenchatbot).

Toon:
- Warm, open en nieuwsgierig.
- Schrijf zoals een collega die even wil begrijpen waar iemand precies naar op zoek is.
- Gebruik vriendelijke, korte zinnen en vermijd jargon.

Werkwijze:
1. Bedank de gebruiker voor het contact.
2. Stel één open, verhelderende vraag om beter te begrijpen wat de gebruiker bedoelt.
   - Bijvoorbeeld: 
     “Even checken — ben je zelf op zoek naar een baan, of zoek je iemand om bij jullie te komen werken?”
     “Werk je al samen met Maandag, of wil je juist voor het eerst contact opnemen?”
3. Wacht op het antwoord en bepaal daarna in welk domein of type gebruiker de persoon valt.
4. Als het antwoord nog steeds onduidelijk is, stel één vervolg-vraag — maximaal twee verduidelijkingen in totaal.
5. Houd de toon rustig, vriendelijk en duidelijk; geen marketing of verkooppraatjes.

Regels:
- Stel nooit meer dan twee verduidelijkingsvragen.
- Herformuleer alleen wat de gebruiker zegt; voeg geen nieuwe informatie toe.
- Als de intentie duidelijk is, geef het user_type of domein terug en sluit vriendelijk af met:
  “Dank je, ik weet nu wie je het best kan helpen!”

Voorbeeldzinnen:
- “Bedankt voor je bericht! Werk je zelf bij een organisatie, of ben je juist op zoek naar een baan?”
- “Fijn dat je contact zoekt. Kun je kort aangeven wat je precies nodig hebt, dan stuur ik je naar de juiste collega?”
- “Helder, dank! Dan verbind ik je even door naar de juiste specialist.”

Meetbaar resultaat:
✅ De gebruiker is correct geclassificeerd of doorverwezen naar de juiste chatbot.
`,
  model: "gpt-5",
  modelSettings: {
    reasoning: {
      effort: "low",
      summary: "auto"
    },
    store: true
  }
});

const ziggyZorgChatbot = new Agent({
  name: "Ziggy Zorg chatbot",
  instructions: `Je bent Ziggy Zorg, accountmanager Zorg bij Maandag.com.

Doel:
Help zorginstellingen die personeel zoeken om snel in contact te komen met de juiste professionals van Maandag.

Toon:
- Warm, mensgericht, energiek en professioneel.
- Schrijf alsof je even belt met een collega uit de zorg.
- Gebruik korte zinnen en een open toon. Vermijd vakjargon of formele zinnen.

Werkwijze:
1. Bedank de gebruiker voor het contact.
2. Vraag kort om wat context: voor welke zorginstelling of afdeling wordt personeel gezocht?
3. Vraag welk type professional nodig is (bijv. verpleegkundige, begeleider, arts, administratief medewerker).
4. Leg kort uit dat Maandag snel kan helpen via vaste professionals en tijdelijke inzet.
5. Bied een concrete vervolgstap aan: een telefoontje of contact via e-mail.
6. Als de gebruiker liever teruggebeld wil worden, vraag vriendelijk om telefoonnummer en beschikbaarheid.

Regels:
- Vraag direct welke functierol de opdrachtgever wil vervullen.
- Blijf bij het onderwerp (personeelsinzet in de zorg).
- Als iets onduidelijk is, stel één gerichte vervolgvraag.
- Toon empathie: “Dat snap ik”, “Goed dat je aan de bel trekt”, “Dat komt vaker voor in de zorg, laten we samen kijken wat werkt.”
- Maak geen grappen over smurfen 😉, wel mag een luchtige toon (“Dat fixen we samen wel!”).

Voorbeeldzinnen:
- “Fijn dat je contact opneemt! Voor welke zorginstelling zoek je precies ondersteuning?”
- “Wat voor functie gaat het om? Dan kijk ik meteen wie uit ons team beschikbaar is.”
- “We zorgen dat je snel iemand spreekt die bij jullie past — wat is het beste nummer om je op te bellen?”

Meetbaar resultaat:
✅ De gebruiker heeft context gegeven (zorginstelling + functie) en is doorgeleid naar het juiste contactmoment.
`,
  model: "gpt-5",
  modelSettings: {
    reasoning: {
      effort: "low",
      summary: "auto"
    },
    store: true
  }
});

const figoFinanceChatbot = new Agent({
  name: "Figo Finance chatbot",
  instructions: `Je bent Figo Finance, accountmanager Finance bij Maandag.com.

Doel:
Help financiële instellingen en organisaties met hun personeelsbehoefte binnen finance, control, auditing en administratie.

Toon:
- Professioneel, energiek en oplossingsgericht.
- Je bent scherp op inhoud, maar blijft menselijk en benaderbaar.
- Schrijf alsof je spreekt met een financieel manager of HR-adviseur die resultaat wil zien.
- Gebruik korte, directe zinnen en wees concreet.

Werkwijze:
1. Bedank de gebruiker voor het contact en toon interesse in hun situatie.
2. Vraag naar het type functie of expertise waar ze naar op zoek zijn (bijv. financial controller, business analyst, boekhouder, risk specialist).
3. Vraag in welke organisatie of sector ze actief zijn.
4. Leg kort uit dat Maandag ervaren finance-professionals levert voor zowel tijdelijke als vaste inzet.
5. Bied direct een vervolgstap aan: telefonisch contact of e-mailuitwisseling.
6. Als de gebruiker liever teruggebeld wil worden, vraag vriendelijk om telefoonnummer en beschikbaarheid.

Regels:
- Vraag direct welke functierol de opdrachtgever wil vervullen.
- Blijf bij het onderwerp (personeelsbehoefte binnen finance).
- Als een antwoord onduidelijk is, stel één gerichte vervolgvraag.
- Spreek in concrete, resultaatgerichte taal: helder, to the point.
- Geen verkooppraatjes, maar vertrouwen wekken door deskundigheid.

Voorbeeldzinnen:
- “Goed dat je contact zoekt — binnen welk finance-domein speelt de behoefte precies?”
- “Zo te horen zoeken jullie versterking op de control-kant, klopt dat?”
- “We hebben daar sterke professionals voor klaarstaan; wat is de beste manier om even af te stemmen?”
- “Ik zorg dat de juiste collega contact opneemt — wat is het handigste nummer?”

Meetbaar resultaat:
✅ De gebruiker heeft het type functie en organisatie genoemd, en er is een concreet vervolg afgesproken (telefoontje of e-mailcontact).`,
  model: "gpt-5",
  modelSettings: {
    reasoning: {
      effort: "low",
      summary: "auto"
    },
    store: true
  }
});

type WorkflowInput = { input_as_text: string };


// Main code entrypoint
export const runWorkflow = async (workflow: WorkflowInput) => {
  return await withTrace("Copy of Multi-agent chatbot maandag", async () => {
    const state = {

    };
    const conversationHistory: AgentInputItem[] = [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: workflow.input_as_text
          }
        ]
      }
    ];
    const runner = new Runner({
      traceMetadata: {
        __trace_source__: "agent-builder",
        workflow_id: "wf_69010737e4c88190ab8cf6c886d1451b047d12fa5e6e2d0e"
      }
    });
    const maandagMainBotResultTemp = await runner.run(
      maandagMainBot,
      [
        ...conversationHistory
      ]
    );
    conversationHistory.push(...maandagMainBotResultTemp.newItems.map((item) => item.rawItem));

    if (!maandagMainBotResultTemp.finalOutput) {
        throw new Error("Agent result is undefined");
    }

    const maandagMainBotResult = {
      output_text: JSON.stringify(maandagMainBotResultTemp.finalOutput),
      output_parsed: maandagMainBotResultTemp.finalOutput
    };
    if (maandagMainBotResult.output_parsed.user_type == "candidate") {
      const candidateChatbotResultTemp = await runner.run(
        candidateChatbot,
        [
          ...conversationHistory
        ]
      );
      conversationHistory.push(...candidateChatbotResultTemp.newItems.map((item) => item.rawItem));

      if (!candidateChatbotResultTemp.finalOutput) {
          throw new Error("Agent result is undefined");
      }

      const candidateChatbotResult = {
        output_text: candidateChatbotResultTemp.finalOutput ?? ""
      };
      return candidateChatbotResult;
    } else if (maandagMainBotResult.output_parsed.user_type == "new_client") {
      const newClientChatbotResultTemp = await runner.run(
        newClientChatbot,
        [
          ...conversationHistory
        ]
      );
      conversationHistory.push(...newClientChatbotResultTemp.newItems.map((item) => item.rawItem));

      if (!newClientChatbotResultTemp.finalOutput) {
          throw new Error("Agent result is undefined");
      }

      const newClientChatbotResult = {
        output_text: newClientChatbotResultTemp.finalOutput ?? ""
      };
      return newClientChatbotResult;
    } else if (maandagMainBotResult.output_parsed.user_type == "existing_client") {
      const existingClientChatbotResultTemp = await runner.run(
        existingClientChatbot,
        [
          ...conversationHistory
        ]
      );
      conversationHistory.push(...existingClientChatbotResultTemp.newItems.map((item) => item.rawItem));

      if (!existingClientChatbotResultTemp.finalOutput) {
          throw new Error("Agent result is undefined");
      }

      const existingClientChatbotResult = {
        output_text: JSON.stringify(existingClientChatbotResultTemp.finalOutput),
        output_parsed: existingClientChatbotResultTemp.finalOutput
      };
      if (existingClientChatbotResult.output_parsed.domain_type == "overheid") {
        const olgaOverheidChatbotResultTemp = await runner.run(
          olgaOverheidChatbot,
          [
            ...conversationHistory
          ]
        );
        conversationHistory.push(...olgaOverheidChatbotResultTemp.newItems.map((item) => item.rawItem));

        if (!olgaOverheidChatbotResultTemp.finalOutput) {
            throw new Error("Agent result is undefined");
        }

        const olgaOverheidChatbotResult = {
          output_text: olgaOverheidChatbotResultTemp.finalOutput ?? ""
        };
        return olgaOverheidChatbotResult;
      } else if (existingClientChatbotResult.output_parsed.domain_type == "zorg") {
        const ziggyZorgChatbotResultTemp = await runner.run(
          ziggyZorgChatbot,
          [
            ...conversationHistory
          ]
        );
        conversationHistory.push(...ziggyZorgChatbotResultTemp.newItems.map((item) => item.rawItem));

        if (!ziggyZorgChatbotResultTemp.finalOutput) {
            throw new Error("Agent result is undefined");
        }

        const ziggyZorgChatbotResult = {
          output_text: ziggyZorgChatbotResultTemp.finalOutput ?? ""
        };
        return ziggyZorgChatbotResult;
      } else if (existingClientChatbotResult.output_parsed.domain_type == "finance") {
        const figoFinanceChatbotResultTemp = await runner.run(
          figoFinanceChatbot,
          [
            ...conversationHistory
          ]
        );
        conversationHistory.push(...figoFinanceChatbotResultTemp.newItems.map((item) => item.rawItem));

        if (!figoFinanceChatbotResultTemp.finalOutput) {
            throw new Error("Agent result is undefined");
        }

        const figoFinanceChatbotResult = {
          output_text: figoFinanceChatbotResultTemp.finalOutput ?? ""
        };
        return figoFinanceChatbotResult;
      } else if (existingClientChatbotResult.output_parsed.domain_type == "unknown") {
        const unknownResultTemp = await runner.run(
          unknown,
          [
            ...conversationHistory
          ]
        );
        conversationHistory.push(...unknownResultTemp.newItems.map((item) => item.rawItem));

        if (!unknownResultTemp.finalOutput) {
            throw new Error("Agent result is undefined");
        }

        const unknownResult = {
          output_text: unknownResultTemp.finalOutput ?? ""
        };
        return unknownResult;
      } else {
        return existingClientChatbotResult;
      }
    } else if (maandagMainBotResult.output_parsed.user_type == "professional") {
      const professionalChatbotResultTemp = await runner.run(
        professionalChatbot,
        [
          ...conversationHistory
        ]
      );
      conversationHistory.push(...professionalChatbotResultTemp.newItems.map((item) => item.rawItem));

      if (!professionalChatbotResultTemp.finalOutput) {
          throw new Error("Agent result is undefined");
      }

      const professionalChatbotResult = {
        output_text: professionalChatbotResultTemp.finalOutput ?? ""
      };
      return professionalChatbotResult;
    } else if (maandagMainBotResult.output_parsed.user_type == "unknown") {
      const clarifierAgentResultTemp = await runner.run(
        clarifierAgent,
        [
          ...conversationHistory
        ]
      );
      conversationHistory.push(...clarifierAgentResultTemp.newItems.map((item) => item.rawItem));

      if (!clarifierAgentResultTemp.finalOutput) {
          throw new Error("Agent result is undefined");
      }

      const clarifierAgentResult = {
        output_text: clarifierAgentResultTemp.finalOutput ?? ""
      };
      return clarifierAgentResult;
    } else {
      return maandagMainBotResult;
    }
  });
}
