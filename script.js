document.getElementById('convert-to-dfa-btn').addEventListener('click', convertAndVisualizeNFAtoDFA);
document.getElementById('convert-to-nfa-btn').addEventListener('click', convertAndVisualizeDFAtoNFA);

function convertAndVisualizeNFAtoDFA() {
  // Gather inputs
  const statesInput = document.getElementById('nfa-states').value.trim();
  const alphabetInput = document.getElementById('nfa-alphabet').value.trim();
  const transitionsInput = document.getElementById('nfa-transitions').value.trim();
  const startState = document.getElementById('nfa-start-state').value.trim();
  const acceptStatesInput = document.getElementById('nfa-accept-states').value.trim();

  // Validate inputs
  if (!statesInput || !alphabetInput || !transitionsInput || !startState || !acceptStatesInput) {
    alert('Please fill in all fields.');
    return;
  }

  // Process inputs
  const states = statesInput.split(',').map(s => s.trim());
  const alphabet = alphabetInput.split(',').map(a => a.trim());
  const acceptStates = acceptStatesInput.split(',').map(s => s.trim());

  if (!states.includes(startState)) {
    alert('Start state must be one of the defined states.');
    return;
  }

  if (!acceptStates.every(s => states.includes(s))) {
    alert('All accept states must be among the defined states.');
    return;
  }

  // Build transitions object
  const transitions = {};
  let validTransitions = true;

  transitionsInput.split('\n').forEach(line => {
    const [fromState, symbol, toState] = line.trim().split(',');
    if (!fromState || !symbol || !toState) return;
    if (!states.includes(fromState) || !states.includes(toState)) validTransitions = false;
    if (symbol !== 'epsilon' && symbol !== 'ε' && !alphabet.includes(symbol)) validTransitions = false;

    if (!transitions[fromState]) transitions[fromState] = {};

    const sym = symbol === 'epsilon' || symbol === 'ε' ? '' : symbol;

    if (!transitions[fromState][sym]) transitions[fromState][sym] = [];
    transitions[fromState][sym].push(toState);
  });

  if (!validTransitions) {
    alert('Transitions contain undefined states or symbols.');
    return;
  }

  const nfa = {
    states,
    alphabet,
    transitions,
    start_state: startState,
    accept_states: acceptStates
  };

  // Visualize NFA
  const nfaDot = generateDot(nfa, 'NFA');
  renderGraph(nfaDot, 'nfa-graph');

  // Begin NFA to DFA conversion logic
  const dfa = nfaToDfa(nfa);
  if (dfa) {
    // Display DFA Transition Table
    displayDFATable(dfa);

    // Visualize DFA
    const dfaDot = generateDot(dfa, 'DFA');
    renderGraph(dfaDot, 'dfa-graph');
  } else {
    alert('Error converting NFA to DFA.');
  }
}

function displayDFATable(dfa) {
  const { states, alphabet, transitions, start_state, accept_states } = dfa;
  let tableHTML = '<table><tr><th>State</th>';

  // Table headers for alphabet symbols
  alphabet.forEach(symbol => {
    tableHTML += `<th>${symbol}</th>`;
  });
  tableHTML += '</tr>';

  // Table rows for each state
  states.forEach(state => {
    const isStart = state === start_state ? '<span class="start-state">&#8594;</span>' : '';
    const isAccept = accept_states.includes(state) ? '<span class="accept-state">*</span>' : '';
    tableHTML += `<tr><td class="state-label">${isStart}${state}${isAccept}</td>`;
    alphabet.forEach(symbol => {
      const nextState = transitions[state] && transitions[state][symbol] ? transitions[state][symbol] : '-';
      tableHTML += `<td>${nextState}</td>`;
    });
    tableHTML += '</tr>';
  });
  tableHTML += '</table>';

  document.getElementById('dfa-table').innerHTML = tableHTML;
}

function renderGraph(dotString, elementId) {
  const viz = new Viz();
  viz.renderSVGElement(dotString)
    .then(function(svgElement) {
      const graphContainer = document.getElementById(elementId);
      graphContainer.innerHTML = '';
      graphContainer.appendChild(svgElement);
    })
    .catch(error => {
      console.error('Error rendering graph:', error);
    });
}

function generateDot(automaton, label) {
  const { states, transitions, start_state, accept_states } = automaton;
  let dot = `digraph ${label} {\n`;
  dot += '  rankdir=LR;\n';
  dot += '  node [shape=circle, fontsize=16, fontname="Arial"];\n';

  // Define start state arrow
  dot += `  "__start__" [shape=none,label=""];\n`;
  dot += `  "__start__" -> "${start_state}";\n`;

  // Define accept states
  for (const state of accept_states) {
    dot += `  "${state}" [shape=doublecircle];\n`;
  }

  // Define transitions
  for (const [fromState, trans] of Object.entries(transitions)) {
    for (const [symbol, toStates] of Object.entries(trans)) {
      const labelSymbol = symbol === '' ? 'ε' : symbol;
      if (Array.isArray(toStates)) {
        for (const toState of toStates) {
          dot += `  "${fromState}" -> "${toState}" [label="${labelSymbol}"];\n`;
        }
      } else {
        dot += `  "${fromState}" -> "${toStates}" [label="${labelSymbol}"];\n`;
      }
    }
  }

  dot += '}';
  return dot;
}

function nfaToDfa(nfa) {
  const { alphabet, transitions, start_state, accept_states } = nfa;
  const newAlphabet = [...alphabet]; // Copy alphabet

  if (containsEpsilonTransition(transitions)) {
    newAlphabet.push(''); // Add epsilon symbol
  }

  const newStates = [];
  const newTransitions = {};
  const newAcceptStates = [];
  const queue = [];
  const stateMap = {};

  // Initialize the DFA with the ε-closure of the NFA's start state
  const startState = epsilonClosure([start_state], transitions);
  const startStateKey = stateKey(startState);
  queue.push(startState);
  stateMap[startStateKey] = startState;
  newStates.push(startStateKey);
  if (startState.some(s => accept_states.includes(s))) {
    newAcceptStates.push(startStateKey);
  }

  while (queue.length > 0) {
    const currentState = queue.shift();
    const currentKey = stateKey(currentState);
    newTransitions[currentKey] = {};

    for (const symbol of alphabet) {
      if (symbol === '') continue; // Skip epsilon transitions for moves
      const moveStates = move(currentState, symbol, transitions);
      const closureStates = epsilonClosure(moveStates, transitions);
      const closureKey = stateKey(closureStates);

      if (closureStates.length === 0) continue;

      if (!stateMap[closureKey]) {
        stateMap[closureKey] = closureStates;
        queue.push(closureStates);
        newStates.push(closureKey);
        if (closureStates.some(s => accept_states.includes(s))) {
          newAcceptStates.push(closureKey);
        }
      }

      newTransitions[currentKey][symbol] = closureKey;
    }
  }

  // Construct DFA
  let dfa = {
    states: newStates,
    alphabet: alphabet,
    transitions: newTransitions,
    start_state: startStateKey,
    accept_states: newAcceptStates
  };

  // Minimize DFA
  dfa = minimizeDFA(dfa);

  return dfa;

  // Helper functions
  function epsilonClosure(states, transitions) {
    const stack = [...states];
    const result = new Set(states);

    while (stack.length > 0) {
      const state = stack.pop();
      const trans = transitions[state];
      if (trans && trans['']) {
        for (const nextState of trans['']) {
          if (!result.has(nextState)) {
            result.add(nextState);
            stack.push(nextState);
          }
        }
      }
    }

    return Array.from(result);
  }

  function move(states, symbol, transitions) {
    const result = [];
    for (const state of states) {
      const trans = transitions[state];
      if (trans && trans[symbol]) {
        result.push(...trans[symbol]);
      }
    }
    return [...new Set(result)];
  }

  function stateKey(states) {
    return states.sort().join('_');
  }

  function containsEpsilonTransition(transitions) {
    for (const trans of Object.values(transitions)) {
      if (trans.hasOwnProperty('')) return true;
    }
    return false;
  }
}

function minimizeDFA(dfa) {
  const { states, alphabet, transitions, start_state, accept_states } = dfa;
  const n = states.length;
  const distinguishable = [];

  // Initialize distinguishability table
  for (let i = 0; i < n; i++) {
    distinguishable[i] = [];
    for (let j = 0; j < n; j++) {
      distinguishable[i][j] = false;
    }
  }

  // Mark distinguishable states (accept vs non-accept)
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const state1 = states[i];
      const state2 = states[j];
      if ((accept_states.includes(state1) && !accept_states.includes(state2)) ||
          (!accept_states.includes(state1) && accept_states.includes(state2))) {
        distinguishable[i][j] = true;
      }
    }
  }

  // Iteratively mark distinguishable states
  let changed;
  do {
    changed = false;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        if (distinguishable[i][j]) continue;
        for (const symbol of alphabet) {
          const next1 = transitions[states[i]] && transitions[states[i]][symbol];
          const next2 = transitions[states[j]] && transitions[states[j]][symbol];
          if (!next1 || !next2) continue;
          const idx1 = states.indexOf(next1);
          const idx2 = states.indexOf(next2);
          if (idx1 > idx2 && distinguishable[idx2][idx1] ||
              idx1 < idx2 && distinguishable[idx1][idx2]) {
            distinguishable[i][j] = true;
            changed = true;
            break;
          }
        }
      }
    }
  } while (changed);

  // Build groups of indistinguishable states
  const groups = [];
  const groupMap = {};
  for (let i = 0; i < n; i++) {
    let foundGroup = false;
    for (const group of groups) {
      const representative = group[0];
      const idxRep = states.indexOf(representative);
      const idxCurr = states.indexOf(states[i]);
      if (idxRep < idxCurr && !distinguishable[idxRep][idxCurr] ||
          idxCurr < idxRep && !distinguishable[idxCurr][idxRep]) {
        group.push(states[i]);
        groupMap[states[i]] = group;
        foundGroup = true;
        break;
      }
    }
    if (!foundGroup) {
      const newGroup = [states[i]];
      groups.push(newGroup);
      groupMap[states[i]] = newGroup;
    }
  }

  // Build minimized DFA
  const minimizedStates = groups.map(g => g.join('_'));
  const minimizedTransitions = {};
  const minimizedAcceptStates = [];
  let minimizedStartState = '';

  for (const group of groups) {
    const groupName = group.join('_');
    if (group.includes(start_state)) {
      minimizedStartState = groupName;
    }
    if (group.some(s => accept_states.includes(s))) {
      minimizedAcceptStates.push(groupName);
    }
    minimizedTransitions[groupName] = {};
    const representative = group[0];
    const trans = transitions[representative];
    for (const symbol of alphabet) {
      const nextState = trans && trans[symbol];
      if (nextState) {
        const nextGroup = groupMap[nextState];
        if (nextGroup) {
          minimizedTransitions[groupName][symbol] = nextGroup.join('_');
        }
      }
    }
  }

  return {
    states: minimizedStates,
    alphabet: alphabet,
    transitions: minimizedTransitions,
    start_state: minimizedStartState,
    accept_states: minimizedAcceptStates
  };
}

// Function to handle DFA to NFA conversion and visualization
function convertAndVisualizeDFAtoNFA() {
  // Gather inputs
  const statesInput = document.getElementById('dfa-states').value.trim();
  const alphabetInput = document.getElementById('dfa-alphabet').value.trim();
  const transitionsInput = document.getElementById('dfa-transitions').value.trim();
  const startState = document.getElementById('dfa-start-state').value.trim();
  const acceptStatesInput = document.getElementById('dfa-accept-states').value.trim();

  // Validate inputs
  if (!statesInput || !alphabetInput || !transitionsInput || !startState || !acceptStatesInput) {
    alert('Please fill in all fields.');
    return;
  }

  // Process inputs
  const states = statesInput.split(',').map(s => s.trim());
  const alphabet = alphabetInput.split(',').map(a => a.trim());
  const acceptStates = acceptStatesInput.split(',').map(s => s.trim());

  if (!states.includes(startState)) {
    alert('Start state must be one of the defined states.');
    return;
  }

  if (!acceptStates.every(s => states.includes(s))) {
    alert('All accept states must be among the defined states.');
    return;
  }

  // Build transitions object
  const transitions = {};
  let validTransitions = true;

  transitionsInput.split('\n').forEach(line => {
    const [fromState, symbol, toState] = line.trim().split(',');
    if (!fromState || !symbol || !toState) return;
    if (!states.includes(fromState) || !states.includes(toState)) validTransitions = false;
    if (!alphabet.includes(symbol)) validTransitions = false;

    if (!transitions[fromState]) transitions[fromState] = {};

    if (!transitions[fromState][symbol]) transitions[fromState][symbol] = [];
    transitions[fromState][symbol].push(toState);
  });

  if (!validTransitions) {
    alert('Transitions contain undefined states or symbols.');
    return;
  }

  const dfa = {
    states,
    alphabet,
    transitions,
    start_state: startState,
    accept_states: acceptStates
  };

  // Visualize DFA
  const dfaDot = generateDot(dfa, 'DFA');
  renderGraph(dfaDot, 'dfa-graph');

  // Begin DFA to NFA conversion logic
  const nfa = dfaToNfa(dfa);
  if (nfa) {
    // Visualize NFA
    const nfaDot = generateDot(nfa, 'NFA');
    renderGraph(nfaDot, 'nfa-from-dfa-graph');
  } else {
    alert('Error converting DFA to NFA.');
  }
}

function dfaToNfa(dfa) {
  const { states, alphabet, transitions, start_state, accept_states } = dfa;
  const nfaTransitions = {};

  for (const [fromState, trans] of Object.entries(transitions)) {
    for (const [symbol, toStates] of Object.entries(trans)) {
      if (!nfaTransitions[fromState]) nfaTransitions[fromState] = {};
      if (!nfaTransitions[fromState][symbol]) nfaTransitions[fromState][symbol] = [];
      nfaTransitions[fromState][symbol].push(toStates);
    }
  }

  const nfa = {
    states,
    alphabet,
    transitions: nfaTransitions,
    start_state,
    accept_states
  };

  return nfa;
}

// Prefill transitions textarea with example transitions
document.getElementById('nfa-transitions').value =
  'q0,a,q0\nq0,a,q1\nq0,b,q0\nq1,a,q2\nq1,b,q2';
document.getElementById('dfa-transitions').value =
  'q0,a,q1\nq0,b,q0\nq1,a,q2\nq1,b,q2\nq2,a,q2\nq2,b,q2';
