(() => {
    console.log("Hasura SQL Helper loaded");

    const DB_NAME = "hasura-queries";

    // ------------------ IndexedDB ------------------
    function initDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, 1);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains("queries")) {
                    const store = db.createObjectStore("queries", {
                        keyPath: "id",
                        autoIncrement: true
                    });

                    store.createIndex("query", "query", { unique: false });
                    store.createIndex("description", "description", { unique: false });
                    store.createIndex("created_at", "created_at", { unique: false });

                    console.log("Object store 'queries' created.");
                }
            };

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // ------------------ Beautify SQL for storage ------------------
    function beautifySQL(sql) {
        if (!sql) return sql;

        let formatted = sql;
        if (window.sqlFormatter) {
            try {
                formatted = window.sqlFormatter.format(sql);
            } catch (e) {
                console.error("SQL formatting failed", e);
            }
        }

        return formatted.trim();
    }

    async function addQuery(db, query, description = "") {
        // Wait 2 seconds so Hasura can show an error toast
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Check if an error toast exists
        const errorToast = document.querySelector(
            '[data-notificationtype="error"] .font-semibold, ' +
            '[data-notificationtype="error"]'
        );

        if (errorToast) {
            console.log("❌ SQL failed — not saving to IndexedDB");
            return;
        }

        // If no error toast → save to DB
        const entry = {
            query: query.replace(/\\n/g, "\n"),
            description: description.trim(),
            created_at: new Date().toISOString(),
        };

        const tx = db.transaction("queries", "readwrite");
        const store = tx.objectStore("queries");
        store.add(entry);

        tx.oncomplete = () => console.log("✅ Stored query:", entry);
        tx.onerror = () => console.error("Failed to store query", tx.error);
    }

    // ------------------ Extract SQL ------------------
    function extractSQLFromAceDOM() {
        const container = document.querySelector("#raw_sql");
        if (!container) return null;

        const lines = container.querySelectorAll(".ace_line");

        return Array.from(lines)
            .map(line => line.textContent)
            .join("\n");
    }

    // ------------------ Create description textarea ------------------
    function createDescriptionTextarea(runButton) {
        if (runButton.nextSibling && runButton.nextSibling.className === "sql-helper-description") {
            return runButton.nextSibling;
        }

        const textarea = document.createElement("textarea");
        textarea.className = "sql-helper-description";
        textarea.placeholder = "Enter description for this query...";
        textarea.style.display = "block";
        textarea.style.width = "100%";
        textarea.style.marginTop = "5px";
        textarea.style.height = "50px";

        runButton.parentNode.insertBefore(textarea, runButton.nextSibling);
        return textarea;
    }

    // ------------------ Beautify button ------------------
    function addBeautifyButton(runButton) {
        if (runButton.__beautify_attached) return;

        const beautifyBtn = document.createElement("button");
        beautifyBtn.textContent = "Beautify";
        beautifyBtn.style.marginLeft = "10px";
        beautifyBtn.style.padding = "4px 10px";
        beautifyBtn.style.border = "1px solid #666";
        beautifyBtn.style.borderRadius = "4px";
        beautifyBtn.style.cursor = "pointer";
        beautifyBtn.style.background = "#eee";

        beautifyBtn.addEventListener("click", () => {
            const sql = extractSQLFromAceDOM();
            if (!sql) {
                alert("No SQL found.");
                return;
            }

            const pretty = beautifySQL(sql);
            alert(pretty || "(empty)");
        });

        runButton.parentNode.insertBefore(beautifyBtn, runButton.nextSibling);

        runButton.__beautify_attached = true;
        console.log("Beautify button added");
    }

    // ------------------ Attach listener to Run button ------------------
    function attachRunButtonListener(db, runButton) {
        if (runButton.__sql_helper_attached) return;

        const descriptionTextarea = createDescriptionTextarea(runButton);

        const span = runButton.querySelector("span");
        if (span) span.textContent = "Run & Save to Hasura Brain!";

        runButton.addEventListener("click", () => {
            const sql = extractSQLFromAceDOM();
            if (sql) addQuery(db, sql, descriptionTextarea.value || "");
        });

        runButton.__sql_helper_attached = true;
        console.log("SQL Helper listener attached to Run button.");

        // ➜ Add beautify button
        addBeautifyButton(runButton);
    }

    // ------------------ Toggle checkbox with smooth pulse ------------------
    function toggleReadOnlyCheckbox() {
        const poll = setInterval(() => {
            const checkbox = document.querySelector(
                'input#read-only-checkbox.Table_add_mar_right_small__qFv07.Table_cursorPointer__LCaz1.legacy-input-fix'
            );

            if (checkbox) {
                clearInterval(poll);

                const lastValue = checkbox.checked;
                checkbox.click();
                console.log(`Checkbox toggled. Previous: ${lastValue}, Now: ${checkbox.checked}`);

                checkbox.style.transition = "box-shadow 0.4s ease-in-out";
                let pulses = 5;
                let count = 0;

                const pulseInterval = setInterval(() => {
                    if (count >= pulses) {
                        clearInterval(pulseInterval);
                        checkbox.style.boxShadow = "";
                        return;
                    }

                    checkbox.style.boxShadow = "0 0 12px 4px red";
                    setTimeout(() => {
                        checkbox.style.boxShadow = "";
                    }, 300);

                    count++;
                }, 600);
            }
        }, 200);
    }

    // ------------------ Observe DOM ------------------
    initDB().then((db) => {
        const observer = new MutationObserver(() => {
            const runButton = document.querySelector('button[data-test="run-sql"]');
            if (runButton) attachRunButtonListener(db, runButton);

            
        });

        observer.observe(document.body, { childList: true, subtree: true });

        const runButton = document.querySelector('button[data-test="run-sql"]');
        if (runButton) attachRunButtonListener(db, runButton);

        toggleReadOnlyCheckbox();
    });
})();
