from flask import Flask, request, jsonify, send_from_directory

app = Flask(__name__, static_folder='')

def nfa_to_dfa(nfa):
    alphabet = nfa['alphabet']
    transitions = nfa['transitions']
    start_state = nfa['start_state']
    accept_states = nfa['accept_states']

    def epsilon_closure(states):
        stack = list(states)
        closure = set(states)
        while stack:
            state = stack.pop()
            if state in transitions and '' in transitions[state]:
                for next_state in transitions[state]['']:
                    if next_state not in closure:
                        closure.add(next_state)
                        stack.append(next_state)
        return closure

    def move(states, symbol):
        next_states = set()
        for state in states:
            if state in transitions and symbol in transitions[state]:
                next_states.update(transitions[state][symbol])
        return next_states

    def state_key(states):
        return '_'.join(sorted(states))

    start_closure = epsilon_closure([start_state])
    unmarked_states = [start_closure]
    dfa_states = {state_key(start_closure): start_closure}
    dfa_transitions = {}
    dfa_accept_states = []

    while unmarked_states:
        current_states = unmarked_states.pop()
        current_key = state_key(current_states)

        if current_key not in dfa_transitions:
            dfa_transitions[current_key] = {}

        for symbol in alphabet:
            if symbol == '':
                continue
            next_states = move(current_states, symbol)
            closure = epsilon_closure(next_states)
            closure_key = state_key(closure)

            if closure_key not in dfa_states:
                dfa_states[closure_key] = closure
                unmarked_states.append(closure)

            dfa_transitions[current_key][symbol] = closure_key

            if any(state in accept_states for state in closure):
                dfa_accept_states.append(closure_key)

    dfa = {
        'states': list(dfa_states.keys()),
        'alphabet': alphabet,
        'transitions': dfa_transitions,
        'start_state': state_key(start_closure),
        'accept_states': dfa_accept_states
    }

    return dfa

def dfa_to_nfa(dfa):
    states = dfa['states']
    alphabet = dfa['alphabet']
    transitions = dfa['transitions']
    start_state = dfa['start_state']
    accept_states = dfa['accept_states']

    nfa_transitions = {}
    for from_state, trans in transitions.items():
        for symbol, to_state in trans.items():
            if from_state not in nfa_transitions:
                nfa_transitions[from_state] = {}
            if symbol not in nfa_transitions[from_state]:
                nfa_transitions[from_state][symbol] = []
            nfa_transitions[from_state][symbol].append(to_state)

    nfa = {
        'states': states,
        'alphabet': alphabet,
        'transitions': nfa_transitions,
        'start_state': start_state,
        'accept_states': accept_states
    }

    return nfa

@app.route('/')
def serve_index():
    return send_from_directory('', 'index.html')

@app.route('/convert_to_dfa', methods=['POST'])
def convert_to_dfa():
    nfa = request.json.get('nfa')
    dfa = nfa_to_dfa(nfa)
    return jsonify(dfa)

@app.route('/convert_to_nfa', methods=['POST'])
def convert_to_nfa():
    dfa = request.json.get('dfa')
    nfa = dfa_to_nfa(dfa)
    return jsonify(nfa)

if __name__ == '__main__':
    app.run(debug=True)