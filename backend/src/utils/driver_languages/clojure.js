/**
 * Build Clojure harness
 * Dependency-free: Manual parsing
 */
export function buildClojureHarness(userSource, signature) {
    const functionName = signature.functionName;
    return `(ns solution)

${userSource}

;; HARNESS
(defn -main []
  (let [input (slurp *in*)
        ;; Regex to extract [5, 10] from "args": [5, 10]
        pattern #\\"\\"args\\":\\s*\\[(\\d+),\\s*(\\d+)\\]\\"
        matcher (re-matcher pattern input)]
    
    (print "{\\"results\\":[")
    
    (loop [first? true]
      (if (.find matcher)
        (let [a (Integer/parseInt (.group matcher 1))
              b (Integer/parseInt (.group matcher 2))
              res (${functionName} a b)]
          (if (not first?) (print ","))
          (print res)
          (recur false))
        nil))
        
    (println "]}")))
`;
}

/**
 * Generate Clojure boilerplate code
 */
export function generateClojureBoilerplate(signature, className) {
    const functionName = signature.functionName;
    const params = signature.params || [];
    const paramList = params.map(p => p.name).join(' ');
    
    return `(defn ${functionName} [${paramList}]
  ;; Write your code here
  
)
`;
}
