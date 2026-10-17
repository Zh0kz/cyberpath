(() => {
  'use strict';

  function normalizeUnicode(value){
    return String(value ?? '')
      .normalize('NFKC')
      .replace(/[–—−]/g,'-')
      .replace(/[→➜➝⇒⟶]+/g,' -> ')
      .replace(/[“”«»„‟"'`]/g,' ')
      .toLowerCase()
      .trim();
  }

  function canonicalize(value){
    let s = normalizeUnicode(value);
    // Common cybersecurity notation: SYN/ACK, SYN-ACK and "SYN ACK" mean the same flag pair.
    s = s.replace(/\bsyn\s*(?:\/|-|\s)\s*ack\b/g,'synack');
    // Normalize common port notations, e.g. 22/tcp -> 22 tcp.
    s = s.replace(/(\d+)\s*\/\s*(tcp|udp)\b/g,'$1 $2');
    // Treat separators as token boundaries while keeping command option text readable.
    s = s.replace(/->/g,' ')
      .replace(/[\\|,;:()[\]{}<>+=!?]+/g,' ')
      .replace(/\//g,' ')
      .replace(/\s*-\s*/g,' ')
      .replace(/\./g,' ')
      .replace(/\s+/g,' ')
      .trim();
    return s;
  }

  function tokens(value){
    const c = canonicalize(value);
    return c ? c.split(' ') : [];
  }

  function containsTokenSequence(haystack, needle){
    const h=tokens(haystack), n=tokens(needle);
    if(!n.length || n.length>h.length) return false;
    outer: for(let i=0;i<=h.length-n.length;i++){
      for(let j=0;j<n.length;j++) if(h[i+j]!==n[j]) continue outer;
      return true;
    }
    return false;
  }

  function shortMatches(value, accepted=[]){
    const v=canonicalize(value);
    if(!v) return false;
    return accepted.some(answer => {
      const a=canonicalize(answer);
      if(!a) return false;
      if(v===a) return true;
      return containsTokenSequence(v,a);
    });
  }

  function fingerprint(value){
    // Stable, human-debuggable fingerprint is enough here; this is not a security hash.
    return canonicalize(value).slice(0,500);
  }

  window.CYBER_VALIDATOR = { canonicalize, tokens, containsTokenSequence, shortMatches, fingerprint };
})();
