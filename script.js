import { site } from './siteconfig.js';
import { TalkingHead } from "./modules/talkinghead.mjs";
import dompurify from 'dompurify';
import { marked } from 'marked';

// API endpoints/proxys
const jwtEndpoint = "/app/jwt/get"; // Get JSON Web Token for Single Sign-On
const openaiChatCompletionsProxy = "/openai/v1/chat/completions";
const openaiModerationsProxy = "/openai/v1/moderations";

const googleTTSProxy = "";

//!---- in google TTS use your own API key so that avatar can speak 


const elevenTTSProxy = [
  "wss://" + window.location.host + "/elevenlabs/",
  "/v1/text-to-speech/",
  "/stream-input?model_id=eleven_multilingual_v2&output_format=pcm_22050"
];
const microsoftTTSProxy = [
  "wss://" + window.location.host + "/mstts/",
  "/cognitiveservices/websocket/v1"
];


// I18n internationalization
const i18n = {

  'fi': {
    'Avatar': 'Hahmo', 'Camera': 'Kamera', 'Audio': 'Ääni', 'Manuscript': 'Käsikirjoitus',
    'Emotion': 'Tunne', 'Neutral': 'Perus', 'Happy': 'Ilo', 'Angry': 'Viha', 'Sad': 'Suru',
    'Fear': 'Pelko', 'Disgust': 'Inho', 'Love': 'Rakkaus', 'Sleep': 'Uni', 'Pose': 'Asento',
    'Action': 'Toiminta', 'Frame': 'Rajaus', 'Full': 'Kokovartalo', 'Upper': 'Yläosa',
    'Head': 'Pää', 'Director': 'Ohjaus', 'Pause': 'Pysäytyskuva', 'Panning': 'Panorointi',
    'Slow-motion': 'Hidastus', 'Ambience': 'Ambienssi', 'Silence': 'Hiljaisuus',
    'Session': 'Sessio', 'Theme': 'Teema', 'Location': 'Paikka', 'Voice': 'Istuva',
    'AI': 'Tekoäly', 'Emoji': 'Emojit', 'Title': 'Otsikko', 'System': 'Ohjeistus',
    'ai-system': 'Järjestelmäviesti.', 'ai-user1': 'Käyttäjän syöte #1',
    'ai-ai1': 'Tekoälyn vaste #1', 'ai-user2': 'Käyttäjän syöte #2',
    'ai-ai2': 'Tekoälyn vaste #2', 'Example1': 'Esim #1', 'Example2': 'Esim #2',
    'Dark': 'Tumma', 'Light': 'Vaalea', 'theme-wide': 'Laajakuva', 'theme-43': '4:3',
    'theme-landscape': 'Vaaka', 'theme-portrait': 'Pysty', 'Empty': 'Tyhjä',
    'Adjust': 'Säätö', 'Speech': 'Puhe', 'Silence': 'Hiljaisuus', 'Framing': 'Rajaus',
    'Mixer': 'Mikseri', 'Space': 'Tila', 'Dry': 'Suora', 'voice-test': 'Äänitesti',
    'Limits': 'Rajat', 'ai-stop': 'Stop', 'ai-stopword': 'Avainsana', 'ai-user': 'Käyttäjä',
    'ai-username': 'Nimi', 'input': 'Kirjoita viesti.', 'Name': 'Nimi', 'Language': 'Kieli',
    'en': 'English', 'fi': 'Finnish', 'words': 'sanaa', 'dialogs': 'sanomaa',
    'Manuscript': 'Käsikirjoitus'
  },

  'en': {
    'ai-system': 'System message.', 'ai-user1': 'User example #1',
    'ai-ai1': 'AI response #1', 'ai-user2': 'User example #2',
    'ai-ai2': 'AI response #2', 'Example1': 'Example-1', 'Example2': 'Example-2',
    'theme-wide': 'Widescreen', 'theme-43': '4:3', 'theme-landscape': 'Landscape',
    'theme-portrait': 'Portrait', 'voice-test': 'Speak', 'ai-stop': 'Stop',
    'ai-user': 'User', 'input': 'Message.', 'en': 'English', 'fi': 'Finnish',
    'ai-stopword': 'Word', 'ai-username': 'Name'
  }

}

// i18n
// Default UI language is English

function i18nWord(w,l) {
  l = l || cfg('theme-lang') || 'en';
  return (( i18n[l] && i18n[l][w] ) ? i18n[l][w] : w);
}

function i18nTranslate(l) {
  l = l || cfg('theme-lang') || 'en';

  // Text
  d3.selectAll("[data-i18n-text]").nodes().forEach( n => {
    const e = d3.select(n);
    e.text( i18nWord(e.attr("data-i18n-text"),l ) );
  });

  // Title
  d3.selectAll("[data-i18n-title]").nodes().forEach( n => {
    const e = d3.select(n);
    e.attr( 'title', i18nWord( e.attr("data-i18n-title"),l ) );
  });

  // Placeholder
  d3.selectAll("[data-i18n-placeholder]").nodes().forEach( n => {
    const e = d3.select(n);
    e.attr( 'placeholder', i18nWord( e.attr("data-i18n-placeholder"),l) );
  });

  // Site
  d3.selectAll("[data-i18n-site]").nodes().forEach( n => {
    const e = d3.select(n);
    const label = e.attr("data-i18n-site");
    const [section, ...rest] = label.split('-');
    const item = rest.join('-');
    let text = item;
    if ( site[section] && site[section][item] && site[section][item][l] ) {
      text = site[section][item][l];
    }
    e.text( text );
  });
}

// Markdown configuration
const markedOptions = { gfm: true, breaks: true };

// Open AI configuration
let aiController = null;

// ElevenLabs configuration
const elevenBOS = {
  "text": " ",
  "voice_settings": { "stability": 0.8, "similarity_boost": true },
  "generation_config": {
    "chunk_length_schedule": [500,500,500,500]
  }
};
let elevenSocket = null;
let elevenInputMsgs = null;
let elevenOutputMsg = null;

// JSON Web Token (JWT)
let jwtExpires = 0;
let jwt = '';

// Get JSON Web Token
async function jwtGet() {
  const limit = Math.round(Date.now() / 1000) + 60;
  if ( jwtExpires < limit ) {
    try {
      const o = await (await fetch( jwtEndpoint, { cache: "no-store" } )).json();
      if ( o && o.jwt ) {
        const b64Url = o.jwt.split('.')[1];
        const b64 = b64Url.replace(/-/g, '+').replace(/_/g, '/');
        const s = decodeURIComponent( window.atob(b64).split('').map( (c) => {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        const p = JSON.parse(s);
        jwtExpires = (p && p.exp) ? p.exp : 0;
        jwt = o.jwt;
      } else {
        jwt = '';
        jwtExpires = 0;
      }
    } catch(e) {
      // console.error(e);
      jwt = '';
      jwtExpires = 0;
    }
  }
  return jwt.slice();
}

// Speak using ElevenLabs
async function elevenSpeak(s,node=null) {
  if ( !elevenSocket ) {
    // Temporary reservation of WebSocket connection
    elevenSocket = { readyState: 0 };

    // Temporary stack of message until the connection is established
    elevenInputMsgs = [
      elevenBOS,
      {
        "text": s,
        "try_trigger_generation": true,
      }
    ];

    // Build the URL
    let url = elevenTTSProxy[0];
    url += await jwtGet();
    url += elevenTTSProxy[1];
    url += cfg('voice-eleven-id');
    url += elevenTTSProxy[2];

    // Make the connection
    elevenSocket = new WebSocket(url);

    // Connection opened
    elevenSocket.onopen = function (event) {
      elevenOutputMsg = null;
      while (elevenInputMsgs.length > 0) {
        elevenSocket.send(JSON.stringify(elevenInputMsgs.shift()));
      }
    }

    // New message received
    elevenSocket.onmessage = function (event) {
      const r = JSON.parse(event.data);

      // Speak audio
      if ( (r.isFinal || r.normalizedAlignment) && elevenOutputMsg ) {
        head.speakAudio( elevenOutputMsg, { lipsyncLang: cfg('voice-lipsync-lang') }, node ? addText.bind(null,node) : null );
        elevenOutputMsg = null;
      }

      if ( !r.isFinal ) {
        // New part
        if ( r.alignment ) {
          elevenOutputMsg = { audio: [], words: [], wtimes: [], wdurations: [] };

          // Parse chars to words
          let word = '';
          let time = 0;
          let duration = 0;
          for( let i=0; i<r.alignment.chars.length; i++ ) {
            if ( word.length === 0 ) time = r.alignment.charStartTimesMs[i];
            if ( word.length && r.alignment.chars[i] === ' ' ) {
              elevenOutputMsg.words.push( word );
              elevenOutputMsg.wtimes.push(time);
              elevenOutputMsg.wdurations.push(duration);
              word = '';
              duration = 0;
            } else {
              duration += r.alignment.charDurationsMs[i];
              word += r.alignment.chars[i];
            }
          }
          if ( word.length ) {
            elevenOutputMsg.words.push(word);
            elevenOutputMsg.wtimes.push(time);
            elevenOutputMsg.wdurations.push(duration);
          }
        }

        // Add audio content to message
        if ( r.audio &&  elevenOutputMsg ) {
          elevenOutputMsg.audio.push( head.b64ToArrayBuffer( r.audio ) );
        }
      }
    };

    // Error
    elevenSocket.onerror = function (error) {
      console.error(`WebSocket Error: ${error}`);
    };

    // Connection closed
    elevenSocket.onclose = function (event) {
      if ( event.wasClean) {
        // console.info(`Connection closed cleanly, code=${event.code}, reason=${event.reason}`);
      } else {
        console.warn('Connection died');
      }
      elevenSocket = null;
    };
  } else {
    let msg = {
      "text": s
    };
    if ( s.length ) {
      msg["try_trigger_generation"] = true;
    }
    if (elevenSocket.readyState === 1) { // OPEN
      elevenSocket.send(JSON.stringify(msg))
    } else if ( elevenSocket.readyState === 0 ) { // CONNECTING
      elevenInputMsgs.push(msg);
    }
  }
}

// Speak using Microsoft
let microsoftSynthesizer = null;
const microsoftQueue= [];

async function microsoftSpeak(s, node=null) {

  if ( s === null ) {
    microsoftQueue.push( null );
  } else {

    // Voice config
    const id = cfg("voice-microsoft-id");
    const e = d3.select("[data-voice-microsoft-id='" + id + "']");
    const lang = e.attr("data-voice-microsoft-lang");

    // SSML
    const ssml = "<speak version='1.0' " +
      "xmlns:mstts='http://www.w3.org/2001/mstts' " +
      "xml:lang='" + lang + "'>" +
      "<voice name='" + id + "'>" +
      "<mstts:viseme type='redlips_front'/>" +
      s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;') +
      "</voice>" +
      "</speak>";

    microsoftQueue.push( {
      ssml: ssml,
      node: node,
      speak: { audio: [], words: [], wtimes: [], wdurations: [], visemes: [], vtimes: [], vdurations: [] }
     } );
  }

  // If this was the first item, start the process
  if ( microsoftQueue.length === 1 ) {
    microsoftProcessQueue();
  }
}

async function microsoftProcessQueue() {

  if ( microsoftQueue.length ) {

    const job = microsoftQueue[0];

    if ( job === null ) {
      microsoftQueue.shift();
      if ( microsoftQueue.length === 0 &&  microsoftSynthesizer ) {
        microsoftSynthesizer.close();
        microsoftSynthesizer = null;
      }
    } else {

      // If we do not a speech synthesizer, create a new
      if ( !microsoftSynthesizer ) {

        // Create a new speech synthesizer
        const endpoint = microsoftTTSProxy[0] + await jwtGet() + microsoftTTSProxy[1];
        const config = window.SpeechSDK.SpeechConfig.fromEndpoint(endpoint);
        config.setProperty("SpeechServiceConnection_Endpoint",endpoint);
        config.speechSynthesisOutputFormat = window.SpeechSDK.SpeechSynthesisOutputFormat.Raw22050Hz16BitMonoPcm;
        microsoftSynthesizer = new window.SpeechSDK.SpeechSynthesizer(config,null);

        // Viseme conversion from Microsoft to Oculus
        // TODO: Check this conversion again!
        const visemeMap = [
          "sil", 'aa', 'aa', 'O', 'E', // 0 - 4
          'E', 'I', 'U', 'O', 'aa', // 5 - 9
          'O', 'I', 'kk', 'RR', 'nn', // 10 - 14
          'SS', 'SS', 'TH', 'FF', 'DD', // 15 - 19
          'kk', 'PP' // 20 - 21
        ];

        // Process visemes
        microsoftSynthesizer.visemeReceived = function(s, e) {
          if ( microsoftQueue[0] && microsoftQueue[0].speak ) {
            const o = microsoftQueue[0].speak;
            const viseme = visemeMap[e.visemeId];
            const time = e.audioOffset / 10000;

            // Calculate the duration of the previous viseme
            if ( o.vdurations.length ) {

              if ( o.visemes[ o.visemes.length-1 ] === 0 ) {
                o.visemes.pop();
                o.vtimes.pop();
                o.vdurations.pop();
              } else {
                // Remove silence
                o.vdurations[ o.vdurations.length-1 ] = time - o.vtimes[ o.vdurations.length-1 ];
              }
            }



            // Add this viseme
            o.visemes.push( viseme );
            o.vtimes.push( time );
            o.vdurations.push( 75 ); // Duration will be fixed when the next viseme is received
          }
        };

        // Process word boundaries and punctuations
        microsoftSynthesizer.wordBoundary = function (s, e) {
          if ( microsoftQueue[0] && microsoftQueue[0].speak ) {
            const o = microsoftQueue[0].speak;
            const word = e.text;
            const time = e.audioOffset / 10000;
            const duration = e.duration / 10000;

            if ( e.boundaryType === "PunctuationBoundary" && o.words.length ) {
              o.words[ o.words.length-1 ] += word;
            } else if ( e.boundaryType === "WordBoundary" || e.boundaryType === "PunctuationBoundary" ) {
              o.words.push( word );
              o.wtimes.push( time );
              o.wdurations.push( duration );
            }
          }
        };
      }

      // Speak the SSML
      microsoftSynthesizer.speakSsmlAsync(job.ssml,
        function (result) {
          if ( microsoftQueue[0] && microsoftQueue[0].speak ) {
            if (result.reason === window.SpeechSDK.ResultReason.SynthesizingAudioCompleted) {
              const job = microsoftQueue[0];
              job.speak.audio.push( result.audioData );
              head.speakAudio(job.speak, {}, job.node ? addText.bind(null,job.node) : null );
            }
            microsoftQueue.shift();
            microsoftProcessQueue();
          }
        }, function (err) {
          console.log(err);
          microsoftQueue.shift();
          microsoftProcessQueue();
        }
      );

    }
  }
}


// Number of words on a string.
function nWords(str) {
  return str ? str.trim().split(/\s+/).length : 0;
}

// Default settings
let CFG = {
  session: 0,
  sessions : [
    {
      name: "Nimetön",
      theme: { lang: 'en', brightness:"light", ratio:"wide", layout:"port" },
      view: { image: 'NONE' },
      avatar: {},
      camera: { frame: 'Head' },
      ai: {},
      voice: { background: "NONE", type: "google", google:{ id: "en-GB-Standard-A"}, lipsync:{ lang: 'en' } }
    },
    {
      name: "Nimetön 2",

      theme: { lang: 'en', brightness: "light", ratio: "wide", layout: "land" },
      view: { image: 'NONE' },
      avatar: {},
      camera: { frame: 'Head' },
      ai: {},
      voice: { background: "NONE", type: "google", google:{ id: "en-GB-Standard-A"}, lipsync:{ lang: 'en' } }
    },
  ]
};

// Dynamically created icons
const svgSelect = '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M10.5858 13.4142L7.75735 10.5858L6.34314 12L10.5858 16.2427L17.6568 9.1716L16.2426 7.75739L10.5858 13.4142Z" fill="currentColor" /></svg>';
const svgSpeak = '<svg viewBox="-2 -2 28 28" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M12 18.939C14.2091 18.939 16 17.1482 16 14.939C16 12.7299 14.2091 10.939 12 10.939C9.79086 10.939 8 12.7299 8 14.939C8 17.1482 9.79086 18.939 12 18.939ZM12 16.939C13.1046 16.939 14 16.0436 14 14.939C14 13.8345 13.1046 12.939 12 12.939C10.8954 12.939 10 13.8345 10 14.939C10 16.0436 10.8954 16.939 12 16.939Z" fill="currentColor" /><path d="M12 9.04401C13.1046 9.04401 14 8.14858 14 7.04401C14 5.93944 13.1046 5.04401 12 5.04401C10.8954 5.04401 10 5.93944 10 7.04401C10 8.14858 10.8954 9.04401 12 9.04401Z" fill="currentColor" /><path fill-rule="evenodd" clip-rule="evenodd" d="M7 1C5.34315 1 4 2.34315 4 4V20C4 21.6569 5.34315 23 7 23H17C18.6569 23 20 21.6569 20 20V4C20 2.34315 18.6569 1 17 1H7ZM17 3H7C6.44772 3 6 3.44772 6 4V20C6 20.5523 6.44772 21 7 21H17C17.5523 21 18 20.5523 18 20V4C18 3.44772 17.5523 3 17 3Z" fill="currentColor" /></svg>'
const svgStop = '<svg viewBox="-2 -2 28 28" xmlns="http://www.w3.org/2000/svg"><path d="M6.2253 4.81108C5.83477 4.42056 5.20161 4.42056 4.81108 4.81108C4.42056 5.20161 4.42056 5.83477 4.81108 6.2253L10.5858 12L4.81114 17.7747C4.42062 18.1652 4.42062 18.7984 4.81114 19.1889C5.20167 19.5794 5.83483 19.5794 6.22535 19.1889L12 13.4142L17.7747 19.1889C18.1652 19.5794 18.7984 19.5794 19.1889 19.1889C19.5794 18.7984 19.5794 18.1652 19.1889 17.7747L13.4142 12L19.189 6.2253C19.5795 5.83477 19.5795 5.20161 19.189 4.81108C18.7985 4.42056 18.1653 4.42056 17.7748 4.81108L12 10.5858L6.2253 4.81108Z" fill="currentColor" /></svg>';
const svgRepost = '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M13.1459 11.0499L12.9716 9.05752L15.3462 8.84977C14.4471 7.98322 13.2242 7.4503 11.8769 7.4503C9.11547 7.4503 6.87689 9.68888 6.87689 12.4503C6.87689 15.2117 9.11547 17.4503 11.8769 17.4503C13.6977 17.4503 15.2911 16.4771 16.1654 15.0224L18.1682 15.5231C17.0301 17.8487 14.6405 19.4503 11.8769 19.4503C8.0109 19.4503 4.87689 16.3163 4.87689 12.4503C4.87689 8.58431 8.0109 5.4503 11.8769 5.4503C13.8233 5.4503 15.5842 6.24474 16.853 7.52706L16.6078 4.72412L18.6002 4.5498L19.1231 10.527L13.1459 11.0499Z" fill="currentColor" /></svg>';

// Get/set config value for the current session
function cfg(key,value) {
  if ( key === undefined ) return CFG.sessions[CFG.session];
  let parts = key.split('-').map( x => isNaN(x) ? x : parseInt(x) );
  if ( value === undefined ) {
    return parts.reduce( (o,p) => o ? o[p] : undefined, CFG.sessions[CFG.session] );
  } else {
    parts.reduce( (o,p,i) => {
      const def = (typeof parts[i+1] === 'number') ? [] : {};
      return (o[p] = (parts.length-1) === i ? value : (o[p] || def));
    }, CFG.sessions[CFG.session] );
  }
}

// Load settings
try {
  let json = localStorage.getItem('talkinghead');
  CFG = (json ? JSON.parse(json) : CFG);
} catch(error) {
  alert("Invalid JSON settings");
  console.error(error);
}

window.cfg = cfg;

// Save config to localStorage and show active session config
let loadingConfig = false;
function saveConfig() {
  if ( !loadingConfig ) {
    let json = JSON.stringify(CFG);
    localStorage.setItem("talkinghead", json);
    json = JSON.stringify( cfg() );
    d3.select("#json").property("value", json );
  }
}

// Load config for the given session
function loadConfig(session = null) {
  try {
    loadingConfig = true;
    let json = localStorage.getItem('talkinghead');
    const config = (json ? JSON.parse(json) : CFG);
    if ( config && config.hasOwnProperty("session") && config.hasOwnProperty("sessions") && config.sessions.length ) {
      CFG = config;
      if ( session !== null && session >= 0 && session < CFG.sessions.length ) {
        CFG.session = session;
        json = JSON.stringify(CFG);
        localStorage.setItem("talkinghead", json);
      }

      // Populate sessions
      d3.selectAll(".session").nodes().forEach( n => {
        const e = d3.select(n);
        const id = parseInt( e.property("id").split("-")[1] );
        if ( id >= 0 && id < CFG.sessions.length ) {
          e.classed("selected", (id === CFG.session) );
        } else {
          e.remove();
        }
      });
      for( let i=0; i<CFG.sessions.length; i++ ) {
        const e = d3.select("#session-"+i);
        if ( e.empty() ) {
          d3.select("#sessions").append("div")
            .property("id","session-"+i)
            .classed("session", true)
            .classed("selected", (i === CFG.session) );
        }
      }

      // Populate directory
      d3.selectAll(".entry").nodes().forEach( n => {
        const e = d3.select(n);
        const id = parseInt( e.property("id").split("-")[1] );
        if ( id >= 0 && id < CFG.sessions.length ) {
          let name = CFG.sessions[id].name;
          if ( !name || name.length === 0 ) {
            name = "Nimetön";
            CFG.sessions[id].name = name;
          }
          e.select("div")
            .classed("selected", (id === CFG.session) )
            .text( name );
        } else {
          e.remove();
        }
      });
      for( let i=0; i<CFG.sessions.length; i++ ) {
        const e = d3.select("#entry-"+i);
        if ( e.empty() ) {
          let n = d3.select("#directory").node().lastElementChild;
          let name = CFG.sessions[i].name;
          if ( !name || name.length === 0 ) {
            name = "Nimetön";
            CFG.sessions[i].name = name;
          }
          let clone = d3.select(n).clone(true);
          clone.property("id","entry-"+i);
          clone.select("[data-session]")
            .attr("data-session", i)
            .classed("selected", (i === CFG.session) )
            .text(name)
            .on('click.command', entrySelect);
          clone.selectAll("[data-entry-move]")
            .on('click.command', entryMove );
        }
      }

      // Populate settings page in specific order
      [
        "[data-item='view-url']", "[data-item='avatar-url']",
        "[data-item='avatar-body']","[data-item]"
      ].forEach( x => {
        d3.selectAll(x).nodes().forEach( (n) => {
          const e = d3.select(n);
          const item = e.attr("data-item");
          const type = e.attr("data-type");
          const range = e.attr("data-range");
          let value = cfg( item );
          if ( value !== undefined ) {
            if ( type === 'option' ) {
              if ( value === e.attr("data-"+item) ) {
                e.dispatch("click");
              }
            } else if ( type === 'value' ) {
              e.property("value",value).dispatch("change");
            }
          } else {
            if ( type === 'option' ) {
              if ( e.classed("selected") ) {
                cfg( item, e.attr("data-"+item) );
                e.dispatch("click");
              }
            } else {
              if ( range !== null ) {
                cfg( item, parseFloat( e.property("value") ) );
              } else {
                cfg( item, e.property("value") );
              }
              e.dispatch("change");
            }
          }
        });
      });

      // Populate other parts of UI,
      d3.select("#name").text( cfg("name") );
      if ( d3.select("[data-item='view-image'].selected").empty() ) {
        d3.select("[data-item='view-image']").classed("selected",true).dispatch('click');
      }
      if ( d3.select("[data-item='avatar-name'].selected").empty() ) {
        d3.select("[data-item='avatar-name']").classed("selected",true).dispatch('click');
      }
      json = JSON.stringify( cfg() );
      d3.select("#json").property("value",json);
    }
  } catch(error) {
    alert("Invalid JSON settings");
    console.error(error);
  } finally {
    loadingConfig = false;
    saveConfig();
  }
}

function motion( action, pose, expression, mood ) {
  try {
    head.setMood(mood || 'neutral');
  } catch(err) {}
  if ( expression ) {
    head.speakEmoji(expression);
  }
  if ( action && site.animations[action] ) {
    head.playAnimation( site.animations[action].url, progressUpdate, site.animations[action].dur || 20 );
  } else if ( pose && site.poses[pose] ) {
    head.playPose( site.poses[pose].url, progressUpdate, site.poses[pose].dur || 60 );
  }
}

// Build outgoing message for OpenAI
function openaiBuildMessage() {
  const msgs = [];

  const systems = [
    { sel: "[data-ai-openai-system]", role: "system" },
    { sel: "[data-ai-openai-user1]", role: "user" },
    { sel: "[data-ai-openai-ai1]", role: "assistant" },
    { sel: "[data-ai-openai-user2]", role: "user" },
    { sel: "[data-ai-openai-ai2]", role: "assistant" }
  ];
  const session = d3.select(".session.selected");
  const input = d3.select("#input");
  const messages = session.selectAll(".message:not(.grayed)");

  const limitDialog = cfg('ai-openai-dialog');
  const limitInput = cfg('ai-openai-input');
  let dialogs = 0;
  let words = 0;

  // System messages
  systems.forEach( x => {
    const n = d3.select(x.sel).node();
    if ( n.value && n.value.length ) {
      if ( n.dataset.words ) {
        words += parseInt( n.dataset.words );
      } else {
        let wc = nWords( n.value );
        n.dataset.words = wc;
        words += wc;
      }
      msgs.push( { n: n, role: x.role, content: n.value } );
    }
  });

  // messages in reverse order
  const revmsgs = [];
  revmsgs.push( { n: input.node(), role: "user", content: input.property("value") } );
  words += nWords( input.property("value") );
  messages.nodes().reverse().forEach( (n) => {
    if ( dialogs < limitDialog && words < limitInput ) {
      let role;
      let val;
      if ( n.dataset.input && n.dataset.input.length ) {
        role = "user";
        val = n.dataset.input;
      } else if ( n.dataset.output && n.dataset.output.length ) {
        role = "assistant";
        val = n.dataset.output;
      }
      if ( role && val ) {
        revmsgs.push( { n: n, role: role, content: val } );
        if ( n.dataset.words ) {
          words += parseInt( n.dataset.words );
        } else {
          let wc = nWords( val );
          n.dataset.words = wc;
          words += wc;
        }
        dialogs++;
      }
    }
  });

  // Build message
  msgs.push( ...revmsgs.reverse() );

  return msgs;
}

// Moderate messages
async function openaiModerateMessage(msgs) {
  // Known status
  let flag = msgs.reduce( (a,b) => ((b.n && b.n.dataset.flag !== undefined) ? ( a | (b.n.dataset.flag === 'true') ) : a ), false);
  let score = msgs.reduce( (a,b) => ((b.n && b.n.dataset.score !== undefined) ? Math.max( a, parseFloat(b.n.dataset.score) ) : a ), 0.0);

  // Moderate only yet unmoderated messages, add the grouped message
  const modMsgs = msgs.filter( x => ( x.n && (x.n.dataset.flag === undefined) && x.content && x.content.length ) );
  if ( modMsgs.length === 0 ) return false;
  if ( msgs.length > 1 ) {
    const full = msgs.map( x => x.content ).join('\n\n');
    modMsgs.push( { content: full } );
  }

  const text = modMsgs.map( x => x.content );
  try {
    const res = await fetch( openaiModerationsProxy, {
      method: "POST",
      mode: "cors",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + await jwtGet()
      },
      body: JSON.stringify({
        input: text
      })
    });

    if ( res.ok ) {

      const data = await res.json();

      if ( data && data.results && data.results.length ) {
        data.results.forEach( (x,i) => {
          let flagtmp = Boolean( x.flagged );
          let scoretmp = 0.0;
          Object.keys(x.categories).forEach( key => {
            scoretmp = Math.max( scoretmp, x.category_scores[key] );
          });

          if ( modMsgs[i].n ) {
            modMsgs[i].n.dataset.flag = flagtmp;
            modMsgs[i].n.dataset.score = scoretmp;
          }

          flag |= flagtmp;
          score = Math.max(score,scoretmp);
        });
      }

      d3.select("#flag").classed("selected",flag);
      d3.select("#score").text( "" + Math.round(100 * score) / 100 );
    } else {
      console.error("Error: Moderation API returned ", res.status);
    }

  } catch (error) {
    console.error("Error: Moderation API returned ", error);
  }

  return flag;
}

// Send messages to OpenAI API and handle streamed response
async function openaiSendMessage(node,msgs) {

  // Create a new AbortController instance
  aiController = new AbortController();
  const signal = aiController.signal;

  // Chat completion
  try {
    // Message body
    const body = {
      model: cfg('ai-model'),
      messages: msgs.map( x => {
        const {role,content,name} = x;
        return (name ? {role,content,name} : {role,content});
      }),
      temperature: cfg('ai-openai-temperature'),
      presence_penalty: cfg('ai-openai-presence'),
      frequency_penalty: cfg('ai-openai-frequency'),
      max_tokens: cfg('ai-openai-output'),
      stream: true
    };
    const stop = cfg('ai-openai-stop');
    if ( stop && stop.length ) {
      body.stop = [ stop ];
    }
    const user = cfg('ai-openai-user');
    if ( user && user.length ) {
      body.user = user;
    }
    const isMotionSelected = d3.select("#motion").classed("selected");
    if ( isMotionSelected ) {
      body.tools = [
        {
          "type": "function",
          "function": {
            "name": "move_body",
            "description": "Set the action, still pose and/or mood of your avatar's body in virtual world",
            "parameters": {
              "type": "object",
              "properties": {
                "action": {
                  "type": "string",
                  "enum": Object.keys(site.animations)
                },
                "stillpose": {
                  "type": "string",
                  "enum": Object.keys(site.poses)
                },
                /* "facialexpression": {
                  "type": "string",
                  "enum": Object.keys(head.animEmojis).map( x => {
                    return x.split("").map((unit) => "\\u" + unit.charCodeAt(0).toString(16).padStart(4, "0")).join("");
                  })
                }, */
                "mood": {
                  "type": "string",
                  "enum": Object.keys(head.animMoods)
                }
                /* "custom-animation": {
                  "type": "string",
                  "description": "A short description of the custom movement, e.g. standing and waving left hand."
                }*/
              },
              "required": []
            }
          }
        }
      ];
      body.tool_choice = "auto";
    }

    // Elements
    node.dataset.output = '';
    let tts;
    let fn;

    do {

      // Ready for either text response or a function call
      tts = '';
      fn = null;

      // Fetch the response from the OpenAI API
      const res = await fetch( openaiChatCompletionsProxy, {
        method: "POST",
        mode: "cors",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + await jwtGet()
        },
        body: JSON.stringify(body),
        signal
      });

      if ( res.ok ) {

        // Read the response as a stream of data
        const reader = res.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let buf = new Uint8Array(512);
        let ndx = 0;
        let ns = -1; // Number of consecutive line break, -1=new chapter begins

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          for (let i = 0; i < value.byteLength; ++i) {
            buf[ndx++] = value[i];
            if ( ns === -1 ) ns = 0;
            ns = (value[i]===10) ? (ns + 1) : 0;
            if ( ns == 2 ) {
              let line = decoder.decode( buf.subarray(0, ndx - 2) );
              if ( !line.startsWith('data: ') ) throw new Error('Expected "data:" prefix in: ' + line);
              line = line.substring(6);
              if ( line === '[DONE]' ) {
                if ( fn ) {
                  console.log(fn);

                  // Function call
                  body.messages.push({
                    role: "assistant",
                    content: null,
                    tool_calls: [
                      {
                        id: fn.id,
                        type: "function",
                        function: {
                          name: fn.name,
                          arguments: fn.arguments
                        }
                      }
                    ]
                  });

                  // TODO: Call the function
                  try {
                    const m = JSON.parse(fn.arguments);
                    motion(m.action, m.stillpose, m.facialexpression, m.mood);
                  } catch(motionError) {
                    console.error(motionError);
                  }

                  // Response
                  body.messages.push({
                    role: "tool",
                    content: "",
                    tool_call_id: fn.id
                  });

                  // Make sure we do not get abother function call
                  body.tool_choice = "none";
                }
                if ( tts ) {
                  if ( cfg('voice-type') === 'eleven' ) {
                    await elevenSpeak( tts.trimStart() + " ", node );
                  } else if ( cfg('voice-type') === 'microsoft' ) {
                    await microsoftSpeak( tts.trimStart() + " ", node );
                  } else {
                    await head.speakText( tts.trimStart(), {
                      lipsyncLang: cfg('voice-lipsync-lang'),
                      ttsVoice: cfg('voice-google-id'),
                      ttsRate: cfg('voice-google-rate'),
                      ttsPitch: cfg('voice-google-pitch')
                    }, addText.bind(null,node) );
                  }
                }
                break;
              } else {
                let obj;
                try {
                  obj = JSON.parse(line);
                } catch(e) {
                  throw new Error( "Error JSON parsing line: " + line );
                }
                if ( obj && obj.error ) throw new Error( obj.error.message || ''+res.status );
                if ( obj && obj.choices && obj.choices[0] && obj.choices[0].delta ) {
                  const delta = obj.choices[0].delta;
                  if ( delta.tool_calls ) {
                    if ( !fn ) fn = { id: '', name: '', arguments: '' };
                    fn.id += delta.tool_calls[0].id || '';
                    fn.name += delta.tool_calls[0].function?.name || '';
                    fn.arguments += delta.tool_calls[0].function?.arguments || '';
                  }
                  if ( delta.content ) {
                    node.dataset.output += delta.content;
                    tts += delta.content;
                  }
                }

                // Speak
                if ( tts ) {
                  let idx = Math.max(tts.lastIndexOf('.'), tts.lastIndexOf('!'), tts.lastIndexOf('?'), tts.lastIndexOf('\n'));
                  if ( idx !== -1 ) {
                    let s = tts.substring(0, idx + 1);
                    if ( s && s.length ) {
                      tts = tts.substring(idx + 1).trimStart();
                      if ( cfg('voice-type') === 'eleven' ) {
                        await elevenSpeak( s + " ", node );
                      } else if ( cfg('voice-type') === 'microsoft' ) {
                        await microsoftSpeak( s + " ", node );
                      } else {
                        await head.speakText( s, {
                          lipsyncLang: cfg('voice-lipsync-lang'),
                          ttsVoice: cfg('voice-google-id'),
                          ttsRate: cfg('voice-google-rate'),
                          ttsPitch: cfg('voice-google-pitch')
                        }, addText.bind(null,node) );
                      }
                    }
                  }
                }
              }

              // Continue
              ndx = 0;
              ns = -1;
            }
          }
        }

        // Moderate
        let flag = await openaiModerateMessage([{ content: node.dataset.output, n: node }]);

      } else {
        console.error( await res.text() );
        throw new Error( json.error ? json.error.message : ''+res.status );
      }

    } while( fn ); // Repeat, if this iteration was a function call

  } catch (error) {
    if ( signal.aborted ) error = "aborted";
    console.error(error);
    addText( node, ' [' + error + ']');
  } finally {
    aiController = null; // Reset the AbortController instance
    if ( elevenSocket ) {
      elevenSpeak("",null);
    }
    microsoftSpeak(null);

    // When this marker has been reached, stop blinking
    head.speakMarker( () => {
      d3.selectAll('.blink').classed("blink",false);
    });
  }
}

// Build outgoing message for Google Gemini Pro
function geminiBuildMessage() {
  const msgs = [];

  const systems = [
    { sel: "[data-ai-gemini-user1]", role: "user" },
    { sel: "[data-ai-gemini-ai1]", role: "model" },
    { sel: "[data-ai-gemini-user2]", role: "user" },
    { sel: "[data-ai-gemini-ai2]", role: "model" }
  ];
  const session = d3.select(".session.selected");
  const input = d3.select("#input");
  const messages = session.selectAll(".message:not(.grayed)");

  const limitDialog = cfg('ai-gemini-dialog');
  const limitInput = cfg('ai-gemini-input');
  let dialogs = 0;
  let words = 0;

  // System messages
  systems.forEach( x => {
    const n = d3.select(x.sel).node();
    if ( n.value && n.value.length ) {
      if ( n.dataset.words ) {
        words += parseInt( n.dataset.words );
      } else {
        let wc = nWords( n.value );
        n.dataset.words = wc;
        words += wc;
      }
      msgs.push( { n: n, role: x.role, content: n.value } );
    }
  });

  // messages in reverse order
  const revmsgs = [];
  revmsgs.push( { n: input.node(), role: "user", content: input.property("value") } );
  words += nWords( input.property("value") );
  messages.nodes().reverse().forEach( (n) => {
    if ( dialogs < limitDialog && words < limitInput ) {
      let role;
      let val;
      if ( n.dataset.input && n.dataset.input.length ) {
        role = "user";
        val = n.dataset.input;
      } else if ( n.dataset.output && n.dataset.output.length ) {
        role = "model";
        val = n.dataset.output;
      }
      if ( role && val ) {
        revmsgs.push( { n: n, role: role, content: val } );
        if ( n.dataset.words ) {
          words += parseInt( n.dataset.words );
        } else {
          let wc = nWords( val );
          n.dataset.words = wc;
          words += wc;
        }
        dialogs++;
      }
    }
  });

  // Build message
  msgs.push( ...revmsgs.reverse() );

  return msgs;
}

// Send messages to Vertex AI API and handle streamed response
async function geminiSendMessage(node,msgs) {

  // Create a new AbortController instance
  aiController = new AbortController();
  const signal = aiController.signal;

  // Elements
  node.dataset.output = '';
  let tts = '';

  // Chat completion
  try {

    // Make sure multiturn messages alternate between user and model
    const messages = [];
    let nextRole = 'user';
    msgs.forEach( x => {
      if ( x.role !== nextRole ) {
        messages.push( { role: nextRole, "parts": { "text": "..." } } )
      }
      messages.push( { role: x.role, "parts": { "text": x.content } } );
      nextRole = x.role === 'user' ? 'model' : 'user';
    });

    // Message body
    const body = {
      contents: messages,
      safetySettings: [
        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" }
      ],
      generationConfig: {
        temperature: cfg('ai-gemini-temperature'),
        maxOutputTokens: cfg('ai-gemini-output'),
        topP: cfg('ai-gemini-topp'),
        topK: cfg('ai-gemini-topk'),
        candidateCount: 1
      }
    };

    // Stop
    const stop = cfg('ai-gemini-stop');
    if ( stop && stop.length ) {
      body.generationConfig.stopSequences = [ stop ];
    }

    // Fetch the response from the Vertex AI API
    const res = await fetch( vertexaiChatCompletionsProxy, {
      method: "POST",
      mode: "cors",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + await jwtGet()
      },
      body: JSON.stringify(body),
      signal
    });

    if ( res.ok ) {

      // Read the response as a stream of data
      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");

      while (true) {
        const { done, value } = await reader.read();

        // Parse partial JSON chunks
        if ( value ) {
          const chunk = decoder.decode(value);
          const start = chunk.indexOf('{');
          const end = chunk.lastIndexOf('}');
          if ( start !== -1 && end !== -1 && start < end ) {
            try {
              const obj = JSON.parse('[' + chunk.substring(start,end+1) + ']');
              if ( obj ) {
                for( let i=0; i<obj.length; i++ ) {
                  if ( obj[i].candidates ) {
                    let c = obj[i].candidates[0].content.parts[0].text;
                    node.dataset.markdown += c;
                    tts += c;
                  }
                }
              }
            } catch(e) {
              throw new Error( "Error JSON parsing line: " + e );
            }
          }
        }

        // Speak
        let ndx = Math.max(tts.lastIndexOf('.'), tts.lastIndexOf('!'), tts.lastIndexOf('?'), tts.lastIndexOf('\n'));
        if ( done || ndx !== -1 ) {
          let s = done ? tts : tts.substring(0, ndx + 1);
          if ( s && s.length ) {
            tts = tts.substring(ndx + 1).trimStart();
            if ( cfg('voice-type') === 'eleven' ) {
              await elevenSpeak( s + " ", node );
            } else if ( cfg('voice-type') === 'microsoft' ) {
              await microsoftSpeak( s + " ", node );
            } else {
              await head.speakText( s, {
                lipsyncLang: cfg('voice-lipsync-lang'),
                ttsVoice: cfg('voice-google-id'),
                ttsRate: cfg('voice-google-rate'),
                ttsPitch: cfg('voice-google-pitch')
              }, addText.bind(null,node) );
            }
          }
        }

        // We are done
        if (done) break;

      }

    } else {
      console.error( await res.text() );
      throw new Error( json.error ? json.error.message : ''+res.status );
    }

  } catch (error) {
    if ( signal.aborted ) error = "aborted";
    console.error(error);
    addText( node, ' [' + error + ']');
  } finally {
    aiController = null; // Reset the AbortController instance
    if ( elevenSocket ) {
      elevenSpeak("",null);
    }
    microsoftSpeak(null);

    // When this marker has been reached, stop blinking
    head.speakMarker( () => {
      d3.selectAll('.blink').classed("blink",false);
    });
  }
}


// Add new message to UI
function addMessage(user = false) {
  const session = d3.select(".session.selected");
  const message = session.append("div");
  message.classed("message", true)
    .classed("user",user)
    .classed("blink",!user);

  // Add selection
  const toolbarLeft = message.append("div");
  toolbarLeft.classed("toolbar-left", true);
  toolbarLeft.append("div")
    .classed("command",true)
    .classed("select", true )
    .on('click', function(ev) {
      let e = d3.select(this);
      let mode = !e.classed("selected");
      e.classed("selected", mode );
      d3.select(this.parentNode.parentNode).classed("grayed", mode );
    })
    .html(svgSelect);

  if ( user ) {
    const toolbarRight = message.append("div");
    toolbarRight.classed("toolbar-right", true);
    toolbarRight.append("div")
      .classed("command", true)
      .on('click', function(ev) {
        let n = this.parentNode.parentNode;
        const text = d3.select(n).attr('data-input');
        while(n) {
          let e = d3.select(n);
          e.classed("grayed",true);
          e.select(".select").classed("selected", true );
          n = n.nextSibling;
        }
        let node = d3.select("#input").property("value",text).dispatch("change").node();
        node.scrollTop = node.scrollHeight;
        node.focus();
      })
      .html(svgRepost);

  } else {
    const toolbarRight = message.append("div");
    toolbarRight.classed("toolbar-right", true);
    toolbarRight.append("div")
      .classed("command", true)
      .on('click', function(ev) {
        const e = d3.select(this.parentNode.parentNode);
        let text = e.attr("data-output");
        if ( text && text.length ) {
          if ( cfg('voice-type') === 'eleven' ) {
            elevenSpeak( text + " " );
            elevenSpeak( "" );
          } else if ( cfg('voice-type') === 'microsoft' ) {
            microsoftSpeak( text );
            microsoftSpeak( null );
          } else {
            head.speakText( text, {
              lipsyncLang: cfg('voice-lipsync-lang'),
              ttsVoice: cfg('voice-google-id'),
              ttsRate: cfg('voice-google-rate'),
              ttsPitch: cfg('voice-google-pitch')
            } );
          }
        }
      })
      .html(svgSpeak);

    toolbarRight.append("div")
      .classed("command", true)
      .on('click', function(ev) {
        head.stopSpeaking();
        // Abort the fetch request by calling abort() on the AbortController instance
        if (aiController) {
          aiController.abort();
          aiController = null;
        }
      })
      .html(svgStop);
  }

  message.append('p');

  const nodeSessions = d3.select("#right-sessions").node();
  nodeSessions.scrollTop = nodeSessions.scrollHeight;

  return message.node();
}

// Add text to session
function addText(node,s) {
  const nodeSessions = d3.select("#right-sessions").node();
  const onbottom = Math.abs( nodeSessions.scrollHeight - nodeSessions.scrollTop - nodeSessions.clientHeight) < 20;
  let last = node.lastElementChild;
  let markdown = (last.dataset.markdown ? last.dataset.markdown : '') + s;
  let ndx = markdown.lastIndexOf('\n\n');
  if ( ndx === -1 ) {
    // Add to the existing paragraph
    last.outerHTML = dompurify.sanitize(marked.parse( markdown, markedOptions ));
    last = node.lastElementChild;
    last.dataset.markdown = markdown;
  } else {
    // First part into the existing paragraph
    let md = markdown.substring(0, ndx);
    last.outerHTML = dompurify.sanitize(marked.parse( md, markedOptions ));
    last = node.lastElementChild;
    last.dataset.markdown = markdown;

    // Last part into a new paragraph
    markdown = markdown.substring(ndx + 2).trimStart();
    last = node.appendChild( document.createElement('p') );
    if ( markdown.length ) {
      last.outerHTML = dompurify.sanitize(marked.parse( markdown, markedOptions ));
      last = node.lastElementChild;
      last.dataset.markdown = markdown;
    }
  }
  if ( onbottom ) nodeSessions.scrollTop = nodeSessions.scrollHeight;
}

// External speak
async function speak(s) {
  let node = addMessage(false);
  if ( cfg('voice-type') === 'eleven' ) {
    await elevenSpeak( s, node );
    await elevenSpeak( "", node );
  } else if ( cfg('voice-type') === 'microsoft' ) {
    await microsoftSpeak( s, node );
    await microsoftSpeak(null);
  } else {
    await head.speakText( s, {
      lipsyncLang: cfg('voice-lipsync-lang'),
      ttsVoice: cfg('voice-google-id'),
      ttsRate: cfg('voice-google-rate'),
      ttsPitch: cfg('voice-google-pitch')
    }, addText.bind(null,node) );
  }

  // When this marker has been reached, stop blinking
  head.speakMarker( () => {
    d3.selectAll('.blink').classed("blink",false);
  });
}
window.talkingheadSpeak = speak;

// Select an directory entry
function entrySelect() {
  reconnectEffect();
  const e = d3.select(this);
  const id = parseInt( e.attr("data-session") );
  d3.selectAll("[data-session]").classed('selected',false);
  e.classed('selected',true);
  loadConfig(id);
  i18nTranslate();
  d3.selectAll("[data-range]").dispatch("change");
}

// Move directory entry
function entryMove() {
  const e = d3.select(this);
  const n = e.node().parentElement; // Entry
  const id = parseInt( n.id.split('-')[1] );
  const directory = d3.select("#directory").node();
  const direction = e.attr("data-entry-move");
  let session = CFG.session;

  if ( direction === 'up' ) {

    // Swap configuration
    var tmp = CFG.sessions[id];
    CFG.sessions[id] = CFG.sessions[id-1];
    CFG.sessions[id-1] = tmp;

    // Swap directory entries
    d3.select(n)
      .property("id","entry-"+(id-1))
      .select("[data-session]")
      .attr("data-session",(id-1));
    d3.select(n.previousElementSibling)
      .property("id","entry-"+id)
      .select("[data-session]")
      .attr("data-session",id);
    directory.insertBefore(n,n.previousElementSibling);
    if ( session === id ) {
      session = id - 1;
    } else if ( session === (id-1) ) {
      session = id;
    }

    // Swap sessions ids (no need to swap their places)
    const s1 = d3.select("#session-"+id);
    const s2 = d3.select("#session-"+(id-1));
    s1.property("id","session-"+(id-1) );
    s2.property("id","session-"+id );

  } else if ( direction === 'down' ) {

    // Swap configuration
    var tmp = CFG.sessions[id];
    CFG.sessions[id] = CFG.sessions[id+1];
    CFG.sessions[id+1] = tmp;

    // Swap directory entries
    d3.select(n)
      .property("id","entry-"+(id+1))
      .select("[data-session]")
      .attr("data-session",(id+1));
    d3.select(n.nextElementSibling)
      .property("id","entry-"+id)
      .select("[data-session]")
      .attr("data-session",id);
    directory.insertBefore(n.nextElementSibling,n);
    if ( session === id ) {
      session = id + 1;
    } else if ( session === (id+1) ) {
      session = id;
    }

    // Swap sessions ids (no need to swap their places)
    const s1 = d3.select("#session-"+id);
    const s2 = d3.select("#session-"+(id+1));
    s1.property("id","session-"+(id+1) );
    s2.property("id","session-"+id );

  }

  // Save new configuration and load the session
  saveConfig();
  loadConfig(session);
  i18nTranslate();
  d3.selectAll("[data-range]").dispatch("change");
}

// Turn on effect
function turnOnEffect() {
  d3.selectAll('.starttransparent').nodes().forEach( panel => {
    const steps = 5 + Math.floor( Math.random() * 10 );
    const ops = [];
    for( let i=steps; i > 0; i-- ) {
      ops.push( { opacity: Math.random() } );
    }
    ops.push( { opacity: 1 } );
    const timing = {
      duration: Math.floor( Math.random() * 2000 ) + 300,
      fill: "forwards"
    };
    panel.animate(ops,timing);
  });
}

// Reconnect effect
function reconnectEffect() {

  // Turn off
  d3.selectAll("#avatar,#view").style("opacity","0");
  d3.select("#left").classed("glow",false);

  // Turn on
  setTimeout( () => {
    d3.selectAll("#avatar,#view").style("opacity","1");
    d3.select("#left").classed("glow",true);
  }, 1000);

}

// Talking Head
let head;

function headLoaded() {

  // Populate emoji tester
  const elEmojis = d3.select("#emojis");
  for( let [em,x] of Object.entries(head.animEmojis) ) {
    elEmojis.append("div")
      .classed("emoji", true)
      .on('click', function(ev) {
        const e = d3.select(this);
        const name = e.text();

        // Clear morphs
        head.getMorphTargetNames().forEach( mt => {
          const el = d3.select('#'+mt);
          if ( !el.empty() ) {
            el.property("value",testerGetValue(mt,null)).dispatch("change");
          }
        });

        const selected = e.classed("selected");
        d3.selectAll(".emoji").classed("selected",false);
        if ( selected ) {
          d3.selectAll(".emoji").classed("selected",false);
        } else {
          e.classed("selected",true);

          // Animate
          head.speakText(name);

          // Update morphs
          const o = head.animEmojis[name];
          if ( o ) {
            head.getMorphTargetNames().forEach( mt => {
              let val = null;
              if ( o.vs &&  o.vs[mt] ) {
                val = o.vs[mt][o.vs[mt].length-1];
                if ( Array.isArray(val) ) val = lastv[0];
              }
              const el = d3.select('#'+mt);
              if ( !el.empty() ) {
                el.property("value",testerGetValue(mt,val)).dispatch("change");
              }
            });
          }
        }
        testerUpdateMorphData();
      })
      .html(em);
  }

  // Populote morph targets (a.k.a. blend shapes)
  const elMorphs = d3.select("#morphs");
  head.getMorphTargetNames().forEach( mt => {
    let v = head.getFixedValue(mt);

    const morph = elMorphs.append("div")
      .classed("row", true)
      .classed("morph", true);

    morph.append("div")
      .classed("text", true)
      .classed("label", true)
      .html(mt);

    morph.append("input")
      .property("id", mt)
      .property("type", "range")
      .property("min", testerGetMin(mt))
      .property("max", testerGetMax(mt))
      .property("step", testerGetStep(mt))
      .property("value", testerGetValue(mt,v))
      .on('input change keyup', function(ev) {
        const e = d3.select(this);
        const mt = e.property("id");
        let v = parseFloat(e.property("value"));
        d3.select(e.node().nextElementSibling).html(testerGetLabel(mt,v));
        head.setFixedValue(mt,testerGetFixedValue(mt,v));
        testerUpdateMorphData();
      });

    morph.append("div")
      .classed("text", true)
      .html(testerGetLabel(mt,v));
  });

  // Unlock Web Audio API
  if ( head.audioCtx.state === 'suspended' ) {
    if ( 'ontouchstart' in window ) {
      let unlockWebAudioAPI = function() {
        head.audioCtx.resume().then( () => {
          document.body.removeEventListener('touchstart', unlockWebAudioAPI);
          document.body.removeEventListener('touchend', unlockWebAudioAPI);
        });
      };
      document.body.addEventListener('touchstart', unlockWebAudioAPI, false);
      document.body.addEventListener('touchend', unlockWebAudioAPI, false);
    }
  }

  setTimeout( () => {
    turnOnEffect();
    reconnectEffect();
    loadConfig();
  }, 1000);
}

// Update progress bar
let progressTimeout;
function progressUpdate(ev) {
  if ( progressTimeout ) {
    clearTimeout(progressTimeout);
    progressTimeout = null;
  } else {
    d3.select("#loading").style("display","block");
  }
  if ( ev.lengthComputable ) {
    let val = Math.min(100,Math.round(ev.loaded/ev.total * 100 ));
    d3.select("#loading-top").style("clip-path", "inset(0 " + (100-val) + "% 0 0)");
    d3.selectAll("#loading-value").text( val + "%" );
  } else {
    d3.select("#loading-top").style("clip-path", "inset(0 0 0 0)");
    d3.selectAll("#loading-value").text( "" + ev.loaded );
  }
  progressTimeout = setTimeout( () => {
    d3.select("#loading").style("display","none");
    progressTimeout = null;
  }, 1000);
}

// Update progress bar using media loading progress
function progressMedia() {
  let bf = this.buffered;
  let dur = this.duration;
  let state = this.readyState;
  if ( bf && bf.length && !Number.isNaN(dur) && dur < Infinity && state > 0 && state < 4) {
    progressUpdate( {
      loaded: bf.end(bf.length-1) - bf.start(bf.length-1),
      total: dur,
      lengthComputable: (dur > 0)
    });
  }
}

function errorShow(error) {
  console.error(error);
}

function testerUpdateMorphData() {
  let s = '{';
  for( let mt of head.getMorphTargetNames() ) {
    const el = d3.select('#'+mt);
    if ( !el.empty() ) {
      const v = testerGetFixedValue( mt, parseFloat(el.property("value")) );
      if ( v !== null ) {
        s += (s.length > 1 ? ',' : '') + ' ' + mt + ': [' + v + ']';
      }
    }
  }
  s += ' }';
  d3.select('#morphdata').property("value",s).dispatch('change');
}

function testerGetValue(mt,v) {
  if ( mt.startsWith('headRotate') || mt.startsWith('eyesRotate') ) {
    return ( v === null || v === undefined ) ? 0 : v;
  } else {
    return ( v === null || v === undefined ) ? -0.1 : v;
  }
}

function testerGetFixedValue(mt,v) {
  if ( mt.startsWith('headRotate') || mt.startsWith('eyesRotate') ) {
    return ( v === 0 ? null : v);
  } else {
    return ( v >= 0 ? v : null);
  }
}

function testerGetMin(mt) {
  if ( mt.startsWith('headRotate') ) {
    return -0.5;
  } else if ( mt.startsWith('eyesRotate') ) {
    return -1;
  } else {
    return -0.1;
  }
}

function testerGetMax(mt) {
  return mt.startsWith('headRotate') ? 0.5 : 1;
}

function testerGetStep(mt) {
  return ( mt.startsWith('headRotate') || mt.startsWith('eyesRotate') ) ? 0.05 : 0.1;
}

function testerGetLabel(mt,v) {
  if ( mt.startsWith('headRotate') || mt.startsWith('eyesRotate') ) {
    return (v ? v : '');
  } else {
    return ( v>=0 ? v : '');
  }
}


// Page ready
document.addEventListener('DOMContentLoaded', async function(e) {

  // Add supported UI languages
  const eLanguages = d3.select("#languages");
  for ( const k of Object.keys(i18n) ) {
    eLanguages.append("div")
      .classed("command", true)
      .classed("selected", k === 'fi' )
      .attr("data-item","theme-lang")
      .attr("data-type","option")
      .attr("data-theme-lang",k)
      .attr("data-i18n-text",k);
  }

  // Add avatar links
  const eAvatars = d3.select("#avatars");
  for ( const [i,k] of Object.entries(Object.keys(site.avatars)) ) {
    eAvatars.append("div")
      .classed("command", true)
      .classed("selected", parseInt(i) === 0 )
      .attr("data-item","avatar-name")
      .attr("data-type","option")
      .attr("data-avatar-name", k )
      .attr("data-i18n-site","avatars-"+k);
  }

  // Add Google voices
  const eGoogleVoices = d3.select("#googlevoices");
  for ( const [i,k] of Object.entries(Object.keys(site.googleVoices)) ) {
    let o = site.googleVoices[k];
    eGoogleVoices.append("div")
      .classed("command", true)
      .classed("selected", parseInt(i) === 0 )
      .attr("data-item","voice-google-id")
      .attr("data-type","option")
      .attr("data-voice-google-id",o.id)
      .attr("data-i18n-site","googleVoices-"+k);
  }

  // Add ElevenLabs voices
  const eElevenVoices = d3.select("#elevenvoices");
  for ( const [i,k] of Object.entries(Object.keys(site.elevenVoices)) ) {
    let o = site.elevenVoices[k];
    eElevenVoices.append("div")
      .classed("command", true)
      .classed("selected", parseInt(i) === 0 )
      .attr("data-item","voice-eleven-id")
      .attr("data-type","option")
      .attr("data-voice-eleven-id",o.id)
      .attr("data-i18n-site","elevenVoices-"+k);
  }

  // Add Microsoft voices
  const eMicrosoftVoices = d3.select("#microsoftvoices");
  for ( const [i,k] of Object.entries(Object.keys(site.microsoftVoices)) ) {
    let o = site.microsoftVoices[k];
    eMicrosoftVoices.append("div")
      .classed("command", true)
      .classed("selected", parseInt(i) === 0 )
      .attr("data-item","voice-microsoft-id")
      .attr("data-type","option")
      .attr("data-voice-microsoft-lang",o.lang)
      .attr("data-voice-microsoft-id",o.id)
      .attr("data-voice-microsoft-viseme", o.viseme )
      .attr("data-i18n-site","microsoftVoices-"+k);
  }

  // Add views
  const eViews = d3.select("#views");
  for ( const [k,o] of Object.entries(site.views) ) {
    eViews.append("div")
      .classed("command", true)
      .attr("data-item","view-image")
      .attr("data-type","option")
      .attr("data-image-type",o.type)
      .attr("data-view-image",o.url)
      .attr("data-i18n-site","views-"+k);
  }

  // Add poses
  const ePoses = d3.select("#poses");
  for ( const [k,o] of Object.entries(site.poses) ) {
    ePoses.append("div")
      .classed("command", true)
      .attr("data-pose",o.url)
      .attr("data-i18n-site","poses-"+k);
  }

  // Add animations
  const eAnimations = d3.select("#animations");
  for ( const [k,o] of Object.entries(site.animations) ) {
    eAnimations.append("div")
      .classed("command", true)
      .attr("data-animation",o.url)
      .attr("data-i18n-site","animations-"+k);
  }

  // Add impulse responses
  const eImpulses = d3.select("#impulses");
  for ( const [k,o] of Object.entries(site.impulses) ) {
    eImpulses.append("div")
      .classed("command", true)
      .attr("data-item","voice-reverb")
      .attr("data-type","option")
      .attr("data-voice-reverb",o.url)
      .attr("data-i18n-site","impulses-"+k);
  }

  // Add music
  const eMusic = d3.select("#music");
  for ( const [k,o] of Object.entries(site.music) ) {
    eMusic.append("div")
      .classed("command", true)
      .attr("data-item","voice-background")
      .attr("data-type","option")
      .attr("data-voice-background",o.url)
      .attr("data-i18n-site","music-"+k);
  }

  // Translate
  i18nTranslate();

  // Create the talking head avatar
  const nodeAvatar = document.getElementById('avatar');
  head = new TalkingHead( nodeAvatar, {
    jwtGet: jwtGet,
    ttsEndpoint: googleTTSProxy,
    cameraZoomEnable: false,
    cameraPanEnable: false,
    cameraView: 'head',
    avatarMood: 'neutral'
  });
  window.head = head;

  // Follow double clicks
  document.body.addEventListener('dblclick', function(e) {
    e = e || window.event;
    if ( !head.touchAt(e.clientX,e.clientY) ) {
      head.lookAt(e.clientX,e.clientY,500)
    }
  });

  // Media progress
  d3.select("#video").node().addEventListener("progress", progressMedia);

  // Auto resize textarea
  d3.selectAll("textarea").on("input.resize change.resize keyup.resize paste.resize", function(e) {
    let pos = this.parentElement.parentElement.scrollTop;
    this.style.height = '0px';
    this.style.height = this.scrollHeight+'px';
    this.parentElement.parentElement.scrollTop = pos;
  });

  // Reset moderation flag, score and word count
  d3.selectAll("textarea").on("input.moderate change.moderate paste.moderate", function(e) {
    delete this.dataset.flag;
    delete this.dataset.score;
    delete this.dataset.words;
  });

// Send message
d3.select("#input").on("keydown", async function(ev) {
    if (ev.keyCode === 13 && !ev.shiftKey) {
        ev.preventDefault();
        const inputElement = d3.select("#input");
        let text = inputElement.property("value").trim();
        if (head && text.length) {
            const nodeInput = addMessage(true); // Visual representation of user input
            nodeInput.dataset.input = text;
            addText(nodeInput, text);
            inputElement.property("value", ""); // Clear the input box
            
            // Make an API call to get the response
            try {
                const response = await fetch('http://34.131.147.151:5006/process_text', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ text: text }),
                    credentials: 'include'
                });
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const data = await response.json();
                
                // Speak the text from the API response through the avatar
                // const responseText = data.response;
                head.speakText(responseText, {
                    lipsyncLang: cfg('voice-lipsync-lang'),
                    ttsVoice: cfg('voice-google-id'),
                    ttsRate: cfg('voice-google-rate'),
                    ttsPitch: cfg('voice-google-pitch')
                }, function() {
                    console.log("Avatar speaking:", responseText);
                    // Here you can handle the post-speaking logic, if needed.
                });
            } catch (error) {
                console.error('There was a problem with the fetch operation:', error);
            }
        }
    }
});


  // Change UI language
  d3.selectAll("[data-theme-lang]").on('click.command', function(ev) {
    const e = d3.select(this);
    d3.selectAll("[data-theme-lang]").classed('selected',false);
    e.classed('selected',true);
    const lang = e.attr("data-theme-lang");
    cfg('theme-lang',lang);
    i18nTranslate();
    d3.selectAll("[data-range]").dispatch("change");
  });

  // Speak test
  d3.select("#playtest").on("click", function(ev) {
    const e = d3.select("[data-voice-test]");
    let text = e.property("value");
    if ( head && text.length ) {
      if ( cfg('voice-type') === 'eleven' ) {
        elevenSpeak( text + " " );
        elevenSpeak( "" );
      } else if ( cfg('voice-type') === 'microsoft' ) {
        microsoftSpeak( text );
        microsoftSpeak( null );
      } else {
        head.speakText( text, {
          lipsyncLang: cfg('voice-lipsync-lang'),
          ttsVoice: cfg('voice-google-id'),
          ttsRate: cfg('voice-google-rate'),
          ttsPitch: cfg('voice-google-pitch')
        } );
      }
    }
  });

  // Repeat
  d3.selectAll("#pose-repeat,#animation-repeat").on("click", function(ev) {
    const e = d3.select(this);
    const sel = e.classed("selected");
    e.classed("selected", !sel );
  });

  d3.select("#pause").on("click", function(ev) {
    const e = d3.select(this);
    const sel = e.classed("selected");
    e.classed("selected", !sel );
    if ( !sel ) {
      head.stop();
    } else {
      head.start();
    }
  });

  d3.select("#slowdown").on("click", function(ev) {
    const e = d3.select(this);
    let k = 2 * head.getSlowdownRate();
    let t = i18nWord('Slow-motion') + ' x' + k;
    if ( k >= 16 ) {
      k = 1;
      t = i18nWord('Slow-motion');
    }
    e.classed("selected", (k > 1) ).text(t);
    head.setSlowdownRate( k );
  });

  d3.select("#autorotate").on("click", function(ev) {
    const e = d3.select(this);
    let k = head.getAutoRotateSpeed() + 10;
    let t = i18nWord('Panning') + ' ' + k;
    if ( k >= 60 ) {
      k = 0;
      t = i18nWord('Panning');
    }
    e.classed("selected", (k > 0) ).text(t);
    head.setAutoRotateSpeed( k );
  });

  // Avatar mood
  d3.selectAll("[data-mood]").on('click.command', function(ev) {
    const e = d3.select(this);
    head.setMood( e.attr('data-mood') );
  });

  // Avatar pose
  d3.selectAll("[data-pose]").on('click.command', async function(ev) {
    const e = d3.select(this);
    const sel = e.classed("selected");
    const repeat = d3.select("#pose-repeat").classed("selected");
    d3.selectAll("[data-pose]").classed("selected",false);
    if ( sel ) {
      head.stopPose();
    } else {
      let pose = e.attr('data-pose');
      if ( pose === 'FILE' ) {
        let input = document.createElement('input');
        input.type = 'file';
        input.onchange = (ev2) => {
          let file = ev2.target.files[0];
          var reader = new FileReader();
          reader.readAsDataURL(file);
          reader.onload = async readerEvent => {
            let content = readerEvent.target.result;
            d3.selectAll("[data-pose='" + pose + "']").classed("selected",repeat);
            head.playPose( content, progressUpdate, (repeat ? 600 : 5) );
          }
        }
        input.click();
      } else {
        d3.selectAll("[data-pose='" + pose + "']").classed("selected",repeat);
        head.playPose( pose, progressUpdate, (repeat ? 600 : 5) );
      }
    }
  });

  d3.selectAll("[data-animation]").on('click.command', async function(ev) {
    const e = d3.select(this);
    const sel = e.classed("selected");
    const repeat = d3.select("#animation-repeat").classed("selected");
    d3.selectAll("[data-animation]").classed("selected",false);
    if ( sel ) {
      head.stopAnimation();
    } else {
      let animation = e.attr('data-animation');
      if ( animation === 'FILE' ) {
        let input = document.createElement('input');
        input.type = 'file';
        input.onchange = (ev2) => {
          let file = ev2.target.files[0];
          var reader = new FileReader();
          reader.readAsDataURL(file);
          reader.onload = async readerEvent => {
            let content = readerEvent.target.result;
            d3.selectAll("[data-animation='" + animation + "']").classed("selected",repeat);
            head.playAnimation( content, progressUpdate, (repeat ? 300 : 7) );
          }
        }
        input.click();
      } else {
        d3.selectAll("[data-animation='" + animation + "']").classed("selected",repeat);
        head.playAnimation( animation, progressUpdate, (repeat ? 300 : 7) );
      }
    }
  });

  // Save configuration changes
  d3.selectAll("[data-item]").on('click.config input.config change.config keyup.config', function(ev) {
    const e = d3.select(this);
    const item = e.attr("data-item");
    const type = e.attr("data-type");
    const range = e.attr("data-range");
    let value;
    if ( type === "option" ) {
      value = e.attr("data-"+item);
    } else if ( type === "value" ) {
      if ( range !== null ) {
        value = parseFloat( e.property("value") );
      } else {
        value = e.property("value");
      }
    }
    if ( !loadingConfig && value !== undefined && cfg( item ) !== value ) {
      cfg( item, value );
      saveConfig();
    }
  });

  // Change session
  d3.selectAll("[data-session]").on('click.command', entrySelect );
  d3.selectAll("[data-entry-move]").on('click.command', entryMove );

  d3.select("#selectall").on("click", function(ev) {
    const e = d3.select(this);
    const mode = !e.classed("selected");
    e.classed("selected", mode);

    d3.select(".session.selected").selectAll(".select").nodes().forEach( (n) => {
      const x = d3.select(n);
      if ( x.classed("selected") !== mode ) {
        x.dispatch("click");
      }
    });
  });

  // Reset range
  d3.selectAll("[data-range-reset]").on('click.command', function(ev) {
    const e = d3.select(this);
    const target = e.attr("data-target");
    const value = parseFloat(e.attr("data-range-reset"));
    d3.select("[data-"+target+"]").property("value",value).dispatch("change");
  });

  // Show value labels
  d3.selectAll("[data-range]").on('input.label change.label keyup.label', function(ev) {
    const e = d3.select(this);
    const n = e.node();
    const type = e.attr("data-range");
    let v = '';
    if ( type === 'float' ) {
      v = Math.round(100 * n.value) / 100;
    } else if ( type === 'second' ) {
      v = Math.round(100 * n.value) / 100 + ' s';
    } else if ( type === 'percentage' ) {
      v = Math.round(100 * n.value) + '%';
    } else if ( type === 'px' ) {
      v = n.value + ' px';
    } else if ( type === 'meter' ) {
      v = n.value + ' m';
    } else if ( type === 'radian' ) {
      v = n.value + ' rad';
    } else if ( type === 'word' ) {
      v = n.value + ' ' + i18nWord('words');
    } else if ( type === 'dialog' ) {
      v = n.value + ' ' + i18nWord('dialogs');
    }
    n.nextElementSibling.textContent = v;
  });

  d3.selectAll("[data-item='name']").on('input.command change.command keyup.command', function(ev) {
    const e = d3.select(this);
    const name = e.property("value");
    d3.select("#entry-"+CFG.session).select("div").text( name );
    d3.select("#name").text( name );
  });

  // Show/hide pages
  d3.selectAll("[data-show]").on('click.command', function(ev) {
    const e = d3.select(this);
    const sel = e.classed("selected");
    const show = e.attr("data-show");
    const parts = show.split("-");

    d3.selectAll("[data-show*='" + parts[0] + "-']").classed("selected", false);
    d3.selectAll("[id*='" + parts[0] + "-']").classed("hidden", true);
    if ( !sel ) {
      e.classed("selected",true);
      d3.select('#'+show)
        .classed("hidden", false)
        .selectAll("textarea").dispatch("keyup");
      if ( parts[0] === 'right' ) {
        d3.select("#right-sessions").classed("hidden", true);
      }
    } else {
      if ( parts[0] === 'right' ) {
        d3.select("#right-sessions").classed("hidden", false);
      }
    }
  });

  d3.selectAll("[data-theme-ratio]").on('click.command', function(ev) {
    const e = d3.select(this);
    d3.selectAll("[data-theme-ratio]").classed('selected',false);
    e.classed('selected',true);
    const main = d3.select("#main");
    d3.selectAll("[data-theme-ratio]").nodes().forEach( x => {
      main.classed("ratio-" + x.dataset.themeRatio, false);
    });
    let ratio = 'ratio-' + d3.select("[data-theme-ratio].selected").attr('data-theme-ratio');
    main.classed(ratio, true);
  });

  d3.selectAll("[data-theme-layout]").on('click.command', function(ev) {
    const e = d3.select(this);
    d3.selectAll("[data-theme-layout]").classed('selected',false);
    e.classed('selected',true);
    const main = d3.select("#main");
    d3.selectAll("[data-theme-layout]").nodes().forEach( x => {
      main.classed("layout-" + x.dataset.themeLayout, false);
    });
    let layout = 'layout-' + d3.select("[data-theme-layout].selected").attr('data-theme-layout');
    main.classed(layout, true);
  });

  d3.selectAll("[data-theme-brightness]").on('click.command', function(ev) {
    const e = d3.select(this);
    d3.selectAll("[data-theme-brightness]").classed('selected',false);
    e.classed('selected',true);
    const body = d3.select("body");
    d3.selectAll("[data-theme-brightness]").nodes().forEach( x => {
      body.classed("theme-" + x.dataset.themeBrightness, false);
    });
    let theme = 'theme-' + d3.select("[data-theme-brightness].selected").attr('data-theme-brightness');
    body.classed(theme, true);
  });

  d3.selectAll("[data-avatar-name]").on('click.command', async function(ev) {
    const e = d3.select(this);
    d3.selectAll("[data-avatar-name]").classed('selected',false);
    let avatar = e.attr('data-avatar-name');
    d3.selectAll("[data-avatar-name='" + avatar + "']").classed("selected",true);
    if ( avatar === 'FILE' ) {
      let input = document.createElement('input');
      input.type = 'file';
      input.onchange = (ev2) => {
        let file = ev2.target.files[0];
        var reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = async readerEvent => {
          d3.selectAll("[data-pose],[data-animation],#pause").classed("selected",false);
          const o = {
            url: readerEvent.target.result,
            body: cfg('avatar-body')
          };
          try {
            await head.showAvatar( o, progressUpdate );
            d3.select("[data-camera-frame].selected").dispatch('click');
          } catch(error) {
            errorShow(error);
          }
        }
      }
      input.click();
    } else if ( avatar === 'URL' ) {
      let url = cfg('avatar-url');
      d3.selectAll("[data-pose],[data-animation],#pause").classed("selected",false);
      const o = {
        url: url,
        body: cfg('avatar-body')
      };
      try {
        await head.showAvatar( o, progressUpdate );
        d3.select("[data-camera-frame].selected").dispatch('click');
      } catch(error) {
        errorShow(error);
      }
    } else {
      const name = e.attr('data-avatar-name');
      d3.selectAll("[data-pose],[data-animation],#pause").classed("selected",false);
      try {
        await head.showAvatar( site.avatars[name], progressUpdate );
        d3.select("[data-camera-frame].selected").dispatch('click');
      } catch(error) {
        errorShow(error);
      }
    }
  });

  d3.selectAll("[data-avatar-brightness],[data-avatar-contrast],[data-avatar-saturate]").on('input.command change.command keyup.command', function(ev) {
    const e = d3.select(this);
    let filters = [];
    d3.selectAll("[data-avatar-brightness],[data-avatar-contrast],[data-avatar-saturate]").nodes().forEach( node => {
      filters.push( (node.dataset.avatarBrightness || node.dataset.avatarContrast || node.dataset.avatarSaturate) + '(' + node.value + ')' );
    });
    d3.select("#avatar").style("filter", filters.join(' ') );
  });

  d3.selectAll("[data-avatar-body]").on('click.command', function(ev) {
    const e = d3.select(this);
    d3.selectAll("[data-avatar-body]").classed('selected',false);
    e.classed('selected',true);
  });

  d3.selectAll("[data-view-image]").on('click.command', function(ev) {
    const e = d3.select(this);
    d3.selectAll("[data-view-image]").classed('selected',false);
    let view = e.attr('data-view-image');
    d3.selectAll("[data-view-image='" + view + "']").classed("selected",true);
    if ( view === 'NONE' ) {
      CFG.sessions[CFG.session].view.image = "NONE";
      d3.select("#main")
        .classed("presence-video",false)
        .classed("presence-vr", true);
      d3.select("#view-video").attr("src","");
      d3.select("#video").node().load();
      d3.select("#view").style("background-image","none" );
    } else if ( view === 'FILE' ) {
      let input = document.createElement('input');
      input.type = 'file';
      input.onchange = (ev2) => {
        let file = ev2.target.files[0];
        var reader = new FileReader();
        if ( file.type.startsWith('image/') ) {
          d3.select("#main")
            .classed("presence-video", true)
            .classed("presence-vr", false);
          reader.readAsDataURL(file);
          reader.onload = readerEvent => {
            d3.select("#view-video").attr("src","");
            d3.select("#video").node().load();
            d3.select("#view").style("background-image","url(" + readerEvent.target.result + ")" );
          }
        } else if ( file.type.startsWith('video/') ) {
          d3.select("#main")
            .classed("presence-video", true)
            .classed("presence-vr", false);
          reader.readAsDataURL(file);
          reader.onload = readerEvent => {
            let content = readerEvent.target.result;
            d3.select("#view-video").attr("src",content);
            d3.select("#video").node().load();
          }
        }
      }
      input.click();
    } else if ( view === 'URL' ) {
      CFG.sessions[CFG.session].view.image = "URL";
      d3.select("#main")
        .classed("presence-video", true)
        .classed("presence-vr", false);
      d3.select("#view-video").attr("src","");
      d3.select("#video").node().load();
      const image = cfg('view-url');
      d3.select("#view").style("background-image","url(" + image + ")" );
    } else {
      CFG.sessions[CFG.session].view.image = view;
      d3.select("#main")
        .classed("presence-video", true)
        .classed("presence-vr", false);
      const image = e.attr('data-view-image');
      const type = e.attr('data-image-type');
      if ( type.startsWith('video/') ) {
        d3.select("#view-video")
          .attr("src", image )
          .attr("type", type );
        d3.select("#video").node().load();
        d3.select("#view").style("background-image","none" );
      } else if ( type.startsWith('image/') ) {
        d3.select("#view-video").attr("src","");
        d3.select("#video").node().load();
        d3.select("#view").style("background-image","url(" + image + ")" );
      }
    }
  });

  d3.selectAll("[data-camera-frame]").on('click.command', function(ev) {
    const e = d3.select(this);
    d3.selectAll("[data-camera-frame]").classed('selected',false);
    const camera = e.attr('data-camera-frame');
    d3.selectAll("[data-camera-frame='" + camera + "']").classed("selected",true);
    const opt = {
      cameraX: cfg("camera-x"),
      cameraY: cfg("camera-y"),
      cameraDistance: cfg("camera-d"),
      cameraRotateX: cfg("camera-rotx"),
      cameraRotateY: cfg("camera-roty")
    };
    head.setView( camera, opt );
  });

  d3.selectAll("[data-camera-x],[data-camera-y],[data-camera-d],[data-camera-rotx],[data-camera-roty]").on('input.command change.command keyup.command', function(ev) {
    d3.select("[data-camera-frame].selected").dispatch('click');
  });

  d3.selectAll("[data-view-brightness],[data-view-contrast],[data-view-saturate],[data-view-blur]").on('input.command change.command keyup.command', function(ev) {
    const e = d3.select(this);
    let filters = [];
    d3.selectAll("[data-view-brightness],[data-view-contrast],[data-view-saturate],[data-view-blur]").nodes().forEach( node => {
      filters.push( (node.dataset.viewBrightness || node.dataset.viewContrast || node.dataset.viewSaturate || node.dataset.viewBlur) + '(' + node.value + (node.dataset.viewBlur ? 'px' :'') + ')' );
    });
    d3.select("#view").style("filter", filters.join(' ') );
  });

  d3.selectAll("[data-voice-type]").on('click.command', function(ev) {
    const e = d3.select(this);
    d3.selectAll("[data-voice-type]").classed('selected',false);
    e.classed('selected',true);
    d3.select("#voice-google").style("display", (e.attr("data-voice-type") === 'google') ? "flex" : "none" );
    d3.select("#voice-eleven").style("display", (e.attr("data-voice-type") === 'eleven') ? "flex" : "none" );
    d3.select("#voice-microsoft").style("display", (e.attr("data-voice-type") === 'microsoft') ? "flex" : "none" );
    d3.select("#lipsync").style("display", (e.attr("data-voice-type") !== 'microsoft') ? "flex" : "none" );
  });

  d3.selectAll("[data-voice-google-id]").on('click.command', function(ev) {
    const e = d3.select(this);
    d3.selectAll("[data-voice-google-id]").classed('selected',false);
    e.classed('selected',true);
  });

  d3.selectAll("[data-voice-eleven-id]").on('click.command', function(ev) {
    const e = d3.select(this);
    d3.selectAll("[data-voice-eleven-id]").classed('selected',false);
    e.classed('selected',true);
  });

  d3.selectAll("[data-voice-microsoft-id]").on('click.command', function(ev) {
    const e = d3.select(this);
    d3.selectAll("[data-voice-microsoft-id]").classed('selected',false);
    e.classed('selected',true);
  });

  d3.selectAll("[data-voice-lipsync-lang]").on('click.command', function(ev) {
    const e = d3.select(this);
    d3.selectAll("[data-voice-lipsync-lang]").classed('selected',false);
    e.classed('selected',true);
  });

  d3.select("[data-voice-mixerbg]").on('input.command change.command keyup.command', function(ev) {
    let gain = parseFloat( d3.select("[data-voice-mixerbg]").property("value") );
    head.setMixerGain( null, gain );
  });

  d3.select("[data-voice-mixerspeech]").on('input.command change.command keyup.command', function(ev) {
    let gain = parseFloat( d3.select("[data-voice-mixerspeech]").property("value") );
    head.setMixerGain( gain, null );
  });

  d3.selectAll("[data-voice-reverb]").on('click.command', function(ev) {
    const e = d3.select(this);
    d3.selectAll("[data-voice-reverb]").classed('selected',false);
    e.classed('selected',true);
    let reverb = e.attr('data-voice-reverb');
    if ( reverb === 'NONE' ) {
      head.setReverb(null);
    } else {
      head.setReverb(reverb);
    }
  });

  d3.selectAll("[data-voice-background]").on('click.command', async function(ev) {
    const e = d3.select(this);
    d3.selectAll("[data-voice-background]").classed("selected",false);
    let background = e.attr('data-voice-background');
    d3.selectAll("[data-voice-background='" + background + "']").classed("selected",true);
    if ( background === 'NONE' ) {
      head.stopBackgroundAudio();
    } else if ( background === 'FILE' ) {
      let input = document.createElement('input');
      input.type = 'file';
      input.onchange = (ev2) => {
        let file = ev2.target.files[0];
        var reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = async readerEvent => {
          let content = readerEvent.target.result;
          head.playBackgroundAudio(content);
        }
      }
      input.click();
    } else {
      head.playBackgroundAudio(background);
    }
  });

  d3.selectAll("[data-ai-model]").on('click.command', function(ev) {
    const e = d3.select(this);
    d3.selectAll("[data-ai-model]").classed('selected',false);
    e.classed('selected',true);
    d3.select("#ai-openai").style("display", (e.attr("data-ai-model").startsWith('gpt') ) ? "flex" : "none" );
    d3.select("#ai-gemini").style("display", (e.attr("data-ai-model").startsWith('gemini') ) ? "flex" : "none" );
  });

  d3.select("#session-duplicate").on('click', function(ev) {
    let id = CFG.sessions.length;
    let clone = JSON.parse( JSON.stringify(cfg()) );
    clone.name = 'Nimetön';
    CFG.sessions.push(clone);
    saveConfig();
    loadConfig(id);
  });

  d3.select("#session-delete").on('click', function(ev) {
    if ( CFG.sessions.length > 1 ) {
      let id = CFG.session;
      CFG.sessions.splice(id,1);
      if ( id > 0 ) id--;
      saveConfig();
      loadConfig(id);
    }
  });

  d3.select("#delete").on("click", function(ev) {
    d3.select("#selectall").classed("selected",false);
    d3.select(".session.selected").selectAll(".select.selected").nodes().forEach( (n) => {
      d3.select(n.parentElement.parentElement).remove();
    });
  });

  d3.select("#flag").on("click", async function(ev) {
    let msgs = openaiBuildMessage();
    let flag = await openaiModerateMessage(msgs);
  });

  d3.select('#copy').on('click', function(ev) {
    const session = d3.select(".session.selected");
    const ms = [];

    [ 'ai-openai-system', 'ai-openai-user1', 'ai-openai-ai1',
      'ai-openai-user2', 'ai-openai-ai2' ].forEach( x => {
      let p = cfg(x);
      if ( p && p.length ) ms.push(p);
    });

    session.selectAll(".message").nodes().forEach( (d) => {
      let e = d3.select(d);
      let md = e.attr("data-input") || e.attr("data-output");
      ms.push( md );
    } );

    const textarea = document.createElement('textarea');
    textarea.value = ms.join("\n\n");
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
  });

  d3.select(window).on('resize.updatesvg', function(ev) {
    d3.selectAll("textarea").dispatch("keyup");
  });

  d3.selectAll("#json").on("blur", function(ev) {
    let e = d3.select(this);
    const json = e.property("value");
    try {
      const c = JSON.parse( json );
      CFG.sessions[CFG.session] = c;
      saveConfig();
      loadConfig();
      i18nTranslate();
    } catch(error) {
      console.error(error);
    }
  });

  // Motion (experimental)
  d3.selectAll("#motion").on("click", function(ev) {
    const e = d3.select(this);
    const sel = e.classed("selected");
    e.classed("selected", !sel );
  });

  try {

    // Get token
    jwt = await jwtGet();

    // Show last avatar
    let o = {};
    let name = cfg('avatar-name') || Object.values(site.avatars)[0].name;
    if ( site.avatars.hasOwnProperty(name) ) {
      o = site.avatars[name];
    } else if ( name === 'URL' ) {
      o.url = cfg('avatar-url');
      o.body = cfg('avatar-body');
    } else {
      o =  Object.values(site.avatars)[0];
    }
    await head.showAvatar( o, progressUpdate);
    headLoaded();
  } catch (error) {
    errorShow(error);

    // Backup plan: show the first avatar in site config
    await head.showAvatar( Object.values(site.avatars)[0], progressUpdate);
    headLoaded();
  }

});


