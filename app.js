const starterPosts = [
    { id: "red-laptop", type: "Lost", title: "Red laptop spotted near the library", description: "A red laptop in a protective sleeve was last seen beside the library study area.", category: "Electronics", location: "Library · Study lounge", date: "Oct 22, 2026" },
    { id: "gold-bracelet", type: "Found", title: "Gold bracelet near the main gate", description: "A delicate bracelet was handed in at the campus information desk.", category: "Accessories", location: "Main gate · Information desk", date: "Oct 20, 2026" },
    { id: "student-id", type: "Found", title: "Student ID near the auditorium", description: "Student identification card found on the main pedestrian path near the auditorium.", category: "ID Cards", location: "Auditorium · Main walkway", date: "Oct 18, 2026" },
    { id: "blue-bottle", type: "Lost", title: "Blue insulated water bottle", description: "Blue stainless-steel bottle with a small white sticker on the side.", category: "Water Bottles", location: "Cafeteria · Seating area", date: "Oct 17, 2026" }
];

const sampleMatches = [{
        score: "85",
        lost: "Lost blue insulated bottle near cafeteria",
        found: "Found blue steel bottle",
        category: "Water Bottles",
        comparison: "Cafeteria tables → Cafeteria seating area",
        summary: "Both reports mention a blue bottle and nearby cafeteria locations.",
        breakdown: [
            ["Category", "Same category", "25/25"],
            ["Keywords", "blue, bottle, insulated", "16/25"],
            ["Location", "Both near cafeteria", "20/20"],
            ["Date", "Close report dates", "15/15"],
            ["Details", "Similar material", "9/15"]
        ]
    },
    {
        score: "79",
        lost: "Lost keys with a red keychain",
        found: "Found keys near the lecture hall",
        category: "Keys",
        comparison: "Lecture hall walkway → Lecture hall entrance",
        summary: "Category, location and keychain details overlap.",
        breakdown: [
            ["Category", "Same category", "25/25"],
            ["Keywords", "keys, red, keychain", "15/25"],
            ["Location", "Both near lecture hall", "20/20"],
            ["Date", "Within one day", "12/15"],
            ["Details", "Similar keychain", "7/15"]
        ]
    }
];

// SUPABASE CONFIGURATION
// Use your real Project URL and Publishable key.
// Never use an sb_secret or service_role key in browser code.
const SUPABASE_URL = "https://hqvhinrapzholwpeuzgq.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_cyNWTvTphuKGdSASHvFH7Q_Sh1lTVsd";

const supabaseConfigured =
    SUPABASE_URL.startsWith("https://") &&
    !SUPABASE_URL.includes("YOUR_SUPABASE") &&
    !SUPABASE_ANON_KEY.includes("YOUR_SUPABASE");

const authClient =
    supabaseConfigured &&
    window.supabase &&
    typeof window.supabase.createClient === "function" ?
    window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) :
    null;

let currentAuthUser = null;

const app = document.querySelector("#app");
const toast = document.querySelector("#toast");

let toastTimer;
let selectedImageData = "";
let activeChat = "Maya · Blue bottle";

let chatMessages = [
    { mine: false, text: "Hi! I think I may have found an item similar to your report." },
    { mine: true, text: "Thanks! Could you tell me where it was found?" }
];

function escapeHtml(value = "") {
    return String(value).replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}

function getUserPosts() {
    try {
        const saved = JSON.parse(
            localStorage.getItem("campusfind-posts") ||
            localStorage.getItem("lost-found-posts") ||
            "[]"
        );

        return Array.isArray(saved) ? saved : [];
    } catch (error) {
        console.error("Could not read saved reports.", error);
        return [];
    }
}

function allPosts() {
    return [...getUserPosts(), ...starterPosts];
}

function getNotifications() {
    try {
        return JSON.parse(
            localStorage.getItem("campusfind-notifications") || "[]"
        );
    } catch {
        return [];
    }
}

function addNotification(title, message) {
    const items = getNotifications();

    items.unshift({
        id: Date.now(),
        title,
        message,
        date: new Date().toLocaleString()
    });

    try {
        localStorage.setItem(
            "campusfind-notifications",
            JSON.stringify(items.slice(0, 20))
        );
    } catch {}

    updateNotificationCount();
    void updateAuthHeader();
}

function updateNotificationCount() {
    const count = document.querySelector("#notification-count");

    if (count) {
        count.textContent = String(
            Math.min(9, 2 + getNotifications().length)
        );
    }
}

function badge(type, status = "Open") {
    return `<span class="badge ${type.toLowerCase()}">${escapeHtml(type)}</span>
            <span class="badge open">${escapeHtml(status)}</span>`;
}

function postCard(post) {
    return `
        <article class="post-card">
            <div class="badges">${badge(post.type)}</div>
            <h3>${escapeHtml(post.title)}</h3>
            <p>${escapeHtml(post.description)}</p>

            <div class="post-meta">
                <p>Category: ${escapeHtml(post.category)}</p>
                <p>Location: ${escapeHtml(post.location)}</p>
                <p>Date: ${escapeHtml(post.date)}</p>
            </div>

            <a class="text-link" href="#post/${encodeURIComponent(post.id)}">
                View details →
            </a>
        </article>
    `;
}

function matchCard(item) {
    return `
        <article class="match-card">
            <div class="match-top">
                <div>
                    <div class="badges">
                        <span class="badge found">Suggested match</span>
                        <span class="badge open">Review details</span>
                    </div>

                    <h3>${escapeHtml(item.lost)}</h3>
                    <p>Possible found report: ${escapeHtml(item.found)}</p>
                </div>

                <div class="score">
                    <strong>${escapeHtml(item.score)}%</strong>
                    <span>Similarity score</span>
                </div>
            </div>

            <div class="match-description">
                <strong>Category: ${escapeHtml(item.category)}</strong>
                <br>
                Location: ${escapeHtml(item.comparison)}
                <br><br>
                ${escapeHtml(item.summary)}
                <br>
                <small>This is a demo similarity score, not a verified AI prediction.</small>
            </div>

            <div class="match-breakdown">
                ${item.breakdown.map(([title, detail, score]) => `
                    <div>
                        <strong>
                            ${escapeHtml(title)}
                            <span style="float:right">${escapeHtml(score)}</span>
                        </strong>
                        <span>${escapeHtml(detail)}</span>
                    </div>
                `).join("")}
            </div>

            <div class="form-actions">
                <a class="button soft small" href="#browse">Review reports</a>
                <a class="button secondary small" href="#chat">Ask about an item</a>
            </div>
        </article>
    `;
}

function intro(eyebrow, title, description) {
    return `
        <div class="page-intro">
            <p class="eyebrow">${escapeHtml(eyebrow)}</p>
            <h1>${escapeHtml(title)}</h1>
            <p>${escapeHtml(description)}</p>
        </div>
    `;
}

function stat(label, value, note = "") {
    return `
        <article class="stat-card">
            <p>${escapeHtml(label)}</p>
            <p>${escapeHtml(value)}</p>
            ${note ? `<div class="stat-note">${escapeHtml(note)}</div>` : ""}
        </article>
    `;
}

function homePage() {
    const posts = allPosts().slice(0, 3);
    const lost = allPosts().filter(p => p.type === "Lost").length;
    const found = allPosts().filter(p => p.type === "Found").length;

    return `
        <div class="home-page">
            <div class="page-wrap">
                <section class="hero">
                    <div class="hero-copy">
                        <p class="eyebrow">✦ Your campus, connected</p>
                        <h1>Lost something? Let's bring it back.</h1>
                        <p>
                            One simple place to report lost belongings, discover found items
                            and connect with the people who can help. Less searching, more finding.
                        </p>

                        <div class="hero-actions">
                            <a class="button primary-light" href="#browse">Explore campus items ↗</a>
                            <a class="button outline-light" href="#report-lost">Report a lost item</a>
                        </div>
                    </div>
                </section>

                <section class="stats-grid" aria-label="Campus recovery overview">
                    ${stat("Campus reports", allPosts().length, "Community posts")}
                    ${stat("Lost items", lost, "Looking for their owners")}
                    ${stat("Found items", found, "Ready to be claimed")}
                    ${stat("Smart suggestions", sampleMatches.length, "Demo matches")}
                </section>

                <section>
                    <div class="section-heading">
                        <p class="eyebrow">Made for campus life</p>
                        <h2>A little smarter. A lot more helpful.</h2>
                        <p>CampusFind brings reports, possible matches and recovery tools together in one friendly place.</p>
                    </div>

                    <div class="feature-grid">
                        <article class="feature-card">
                            <div class="feature-icon">⌕</div>
                            <h3>Smart item matching</h3>
                            <p>See possible matches with a clear similarity breakdown so you can decide what to check.</p>
                        </article>

                        <article class="feature-card">
                            <div class="feature-icon">▧</div>
                            <h3>Image-based search</h3>
                            <p>Choose a photo and keep item details together. Visual AI recognition needs a connected model service.</p>
                        </article>

                        <article class="feature-card">
                            <div class="feature-icon">✓</div>
                            <h3>Safer claim process</h3>
                            <p>Use claim details and verify ownership before arranging a handover.</p>
                        </article>

                        <article class="feature-card">
                            <div class="feature-icon">↗</div>
                            <h3>Impact dashboard</h3>
                            <p>View the current demo report counts and recovery activity in simple charts.</p>
                        </article>

                        <article class="feature-card">
                            <div class="feature-icon">♡</div>
                            <h3>Helpful notifications</h3>
                            <p>See local updates when you create a report or send a demo chat message.</p>
                        </article>

                        <article class="feature-card">
                            <div class="feature-icon">↔</div>
                            <h3>Private chat concept</h3>
                            <p>Try the chat interface prototype. Real multi-user messaging requires a backend.</p>
                        </article>
                    </div>
                </section>

                <section>
                    <div class="section-title-row">
                        <h2>Recently reported</h2>
                        <a class="text-link" href="#browse">Browse all →</a>
                    </div>

                    <div class="post-grid">
                        ${posts.map(postCard).join("")}
                    </div>
                </section>

                <section>
                    <div class="section-title-row">
                        <h2>Possible matches for you</h2>
                        <a class="text-link" href="#matches">See all matches →</a>
                    </div>

                    <div class="match-list">
                        ${sampleMatches.slice(0, 1).map(matchCard).join("")}
                    </div>
                </section>
            </div>
        </div>
    `;
}

function browsePage() {
    return `
        <div class="inner-page">
            <div class="page-wrap">
                ${intro(
                    "Community board",
                    "Browse campus items",
                    "Search posts and narrow results by category or report type."
                )}

                <section class="panel">
                    <div class="filters">
                        <input class="search-field" id="post-search" type="search"
                            placeholder="Search item, location or details…"
                            aria-label="Search posts">

                        <select class="search-field" id="post-category" aria-label="Filter by category">
                            <option value="">All categories</option>
                            ${["Accessories", "Electronics", "ID Cards", "Keys", "Water Bottles", "Books & Notes", "Clothing", "Other"]
                                .map(c => `<option>${c}</option>`).join("")}
                        </select>

                        <select class="search-field" id="post-type" aria-label="Filter by type">
                            <option value="">All reports</option>
                            <option>Lost</option>
                            <option>Found</option>
                        </select>
                    </div>

                    <div class="post-grid" id="browse-results"></div>
                </section>
            </div>
        </div>
    `;
}

function renderBrowseResults() {
    const results = document.querySelector("#browse-results");
    if (!results) return;

    const query = document.querySelector("#post-search").value.trim().toLowerCase();
    const category = document.querySelector("#post-category").value;
    const type = document.querySelector("#post-type").value;

    const found = allPosts().filter(post => {
        const searchable = [
            post.title,
            post.description,
            post.location,
            post.category
        ].join(" ").toLowerCase();

        return (!query || searchable.includes(query)) &&
            (!category || post.category === category) &&
            (!type || post.type === type);
    });

    results.innerHTML = found.length
        ? found.map(postCard).join("")
        : `<div class="empty-card" style="grid-column:1/-1">
               <h2>No reports found</h2>
               <p>Try another search or clear a filter.</p>
           </div>`;
}

function reportPage(type) {
    const lost = type === "Lost";

    return `
        <div class="inner-page">
            <div class="page-wrap">
                ${intro(
                    "Create a report",
                    `Report a ${type.toLowerCase()} item`,
                    "Add helpful details so the campus community can recognize the item."
                )}

                <section class="panel">
                    <form id="report-form" data-type="${type}">
                        <div class="form-grid">
                            <div class="field full">
                                <label for="item-title">Item name</label>
                                <input id="item-title" name="title"
                                    placeholder="${lost ? "e.g. Black water bottle" : "e.g. Keys with blue tag"}"
                                    required maxlength="90">
                            </div>

                            <div class="field">
                                <label for="item-category">Category</label>
                                <select id="item-category" name="category" required>
                                    <option value="">Choose a category</option>
                                    ${["Accessories", "Electronics", "ID Cards", "Keys", "Water Bottles", "Books & Notes", "Clothing", "Other"]
                                        .map(c => `<option>${c}</option>`).join("")}
                                </select>
                            </div>

                            <div class="field">
                                <label for="item-date">${lost ? "Date last seen" : "Date found"}</label>
                                <input id="item-date" name="date" type="date" required>
                            </div>

                            <div class="field full">
                                <label for="item-location">Campus location</label>
                                <input id="item-location" name="location"
                                    placeholder="Building, area or nearby landmark"
                                    required maxlength="100">
                            </div>

                            <div class="field full">
                                <label for="item-description">Description</label>
                                <textarea id="item-description" name="description"
                                    placeholder="Share useful identifying details. Avoid sensitive personal information."
                                    required maxlength="600"></textarea>
                                <p class="helper-text">Keep one or two private details for ownership verification.</p>
                            </div>

                            <div class="field">
                                <label for="contact-email">Contact email (demo only)</label>
                                <input id="contact-email" name="email" type="email"
                                    placeholder="you@campus.edu" required>
                            </div>

                            <div class="field">
                                <label for="item-photo">Item photo (optional)</label>
                                <input id="item-photo" name="photo" type="file" accept="image/*">
                                <p class="helper-text">This demo stores report text only; photos are not uploaded to a server.</p>
                            </div>
                        </div>

                        <div class="form-actions">
                            <button class="button" type="submit">Publish ${type.toLowerCase()} report ↗</button>
                            <a class="button secondary" href="#browse">Cancel</a>
                        </div>
                    </form>
                </section>
            </div>
        </div>
    `;
}

function matchesPage() {
    const userPosts = getUserPosts();
    const lost = allPosts().filter(p => p.type === "Lost").length;
    const found = allPosts().filter(p => p.type === "Found").length;

    return `
        <div class="inner-page">
            <div class="page-wrap">
                ${intro(
                    "Smart suggestions",
                    "Possible item matches",
                    "Compare reports using a simple demo similarity score. Confirm details yourself before arranging a return."
                )}

                <div class="stats-grid" style="margin:0 0 18px">
                    ${stat("Lost reports", lost)}
                    ${stat("Found reports", found)}
                    ${stat("Suggested matches", sampleMatches.length)}
                    ${stat("User reports", userPosts.length)}
                </div>

                <div class="match-list">${sampleMatches.map(matchCard).join("")}</div>
                <p class="helper-text" style="margin-top:15px">
                    Note: Matching is currently sample/demo data. It is not connected to a live AI service.
                </p>
            </div>
        </div>
    `;
}

function myPostsPage() {
    const posts = getUserPosts();

    return `
        <div class="inner-page">
            <div class="page-wrap">
                ${intro("Your activity", "My posts", "Reports created in this browser are shown here.")}

                ${posts.length
                    ? `<div class="post-grid">${posts.map(postCard).join("")}</div>`
                    : `<div class="empty-card">
                        <h2>Your first report starts here</h2>
                        <p>Once you publish a lost or found report, it will appear here.</p>
                        <div class="form-actions" style="justify-content:center">
                            <a class="button" href="#report-lost">Report lost</a>
                            <a class="button secondary" href="#report-found">Report found</a>
                        </div>
                    </div>`
                }
            </div>
        </div>
    `;
}

function requestsPage() {
    const requests = (() => {
        try {
            return JSON.parse(localStorage.getItem("campusfind-requests") || "[]");
        } catch {
            return [];
        }
    })();

    return `
        <div class="inner-page">
            <div class="page-wrap">
                ${intro("Recovery activity", "My requests", "Keep an eye on the claim requests you start in this demo.")}

                ${requests.length
                    ? `<div class="notification-list">
                        ${requests.map(r => `
                            <article class="notification-card">
                                <div class="notification-icon">✓</div>
                                <div>
                                    <h3>${escapeHtml(r.title)}</h3>
                                    <p>${escapeHtml(r.message)} · ${escapeHtml(r.date)}</p>
                                </div>
                            </article>
                        `).join("")}
                    </div>`
                    : `<div class="empty-card">
                        <h2>No requests yet</h2>
                        <p>Open an item and choose “Start a claim” to create a local demo request.</p>
                        <a class="button" href="#browse">Browse items</a>
                    </div>`
                }
            </div>
        </div>
    `;
}

function postDetails(id) {
    const post = allPosts().find(item => item.id === id);

    if (!post) {
        return `
            <div class="inner-page">
                <div class="page-wrap">
                    ${intro("Campus post", "Report not found", "This report may have been removed.")}
                    <a class="button" href="#browse">Browse items</a>
                </div>
            </div>
        `;
    }

    return `
        <div class="inner-page">
            <div class="page-wrap">
                ${intro("Item details", post.title, "Review the report and start a claim if you believe this could be your item.")}

                <article class="panel">
                    <div class="badges">${badge(post.type)}</div>
                    <p style="margin:17px 0;color:var(--muted);line-height:1.8">
                        ${escapeHtml(post.description)}
                    </p>

                    <div class="post-meta">
                        <p>Category: ${escapeHtml(post.category)}</p>
                        <p>Location: ${escapeHtml(post.location)}</p>
                        <p>Date: ${escapeHtml(post.date)}</p>
                    </div>

                    <div class="claim-box" style="margin-top:18px">
                        <h3>Secure claim checklist</h3>
                        <p>
                            Before handing over an item, ask the claimant to describe a detail
                            that was not included in the public report. Meet in a public campus
                            location and follow campus policy. This checklist is a UI prototype,
                            not official identity verification.
                        </p>

                        <form id="claim-form" data-post-id="${escapeHtml(post.id)}">
                            <div class="field">
                                <label for="claim-detail">Private identifying detail</label>
                                <textarea id="claim-detail" name="detail"
                                    placeholder="Describe a detail that helps confirm ownership…"
                                    required maxlength="300"></textarea>
                            </div>

                            <div class="form-actions">
                                <button class="button" type="submit">Start claim request</button>
                                <a class="button secondary" href="#chat">Open chat demo</a>
                                <a class="button secondary" href="#browse">Back to browse</a>
                            </div>
                        </form>
                    </div>
                </article>
            </div>
        </div>
    `;
}

function dashboardPage() {
    const posts = allPosts();
    const lost = posts.filter(p => p.type === "Lost").length;
    const found = posts.filter(p => p.type === "Found").length;
    const categories = ["Electronics", "Accessories", "ID Cards", "Keys", "Water Bottles", "Other"];
    const values = categories.map(c => posts.filter(p => p.category === c).length);
    const max = Math.max(1, ...values);

    return `
        <div class="inner-page">
            <div class="page-wrap">
                ${intro(
                    "Campus impact",
                    "Recovery dashboard",
                    "A quick look at the reports currently available in this browser. Counts are based on demo and locally saved reports."
                )}

                <div class="stats-grid">
                    ${stat("Total reports", posts.length)}
                    ${stat("Lost reports", lost)}
                    ${stat("Found reports", found)}
                    ${stat("Local user posts", getUserPosts().length)}
                </div>

                <div class="chart-grid" style="margin-top:15px">
                    <section class="chart-card">
                        <h3>Lost vs found</h3>
                        <p>Current reports by type</p>
                        <div class="bar-chart">
                            ${[["Lost", lost], ["Found", found]].map(([label, val]) => `
                                <div class="bar-group">
                                    <span class="bar-value">${val}</span>
                                    <div class="bar" style="height:${Math.max(5, val / Math.max(1, lost, found) * 115)}px"></div>
                                    <span class="bar-label">${label}</span>
                                </div>
                            `).join("")}
                        </div>
                    </section>

                    <section class="chart-card">
                        <h3>Items by category</h3>
                        <p>Report distribution</p>
                        <div class="bar-chart">
                            ${categories.map((label, i) => `
                                <div class="bar-group">
                                    <span class="bar-value">${values[i]}</span>
                                    <div class="bar" style="height:${Math.max(5, values[i] / max * 115)}px"></div>
                                    <span class="bar-label">${escapeHtml(label)}</span>
                                </div>
                            `).join("")}
                        </div>
                    </section>
                </div>

                <p class="helper-text" style="margin-top:13px">
                    This is a front-end demo dashboard, not a live campus-wide analytics service.
                </p>
            </div>
        </div>
    `;
}

function imageSearchPage() {
    return `
        <div class="inner-page">
            <div class="page-wrap">
                ${intro(
                    "Visual discovery",
                    "Search with an image",
                    "Choose a photo to preview it, then search report text for matching details. Visual AI recognition can be added when a model/API is connected."
                )}

                <div class="tool-grid">
                    <section class="tool-card">
                        <h2>Upload an item photo</h2>
                        <p>Choose a picture from your device. The image preview stays in this browser and is not uploaded.</p>

                        <div class="upload-zone">
                            <strong>▧ Add an item image</strong>
                            <span class="helper-text">JPG, PNG or WEBP</span>
                            <input type="file" id="image-search-file" accept="image/*">
                            <div id="image-preview-wrap"></div>
                        </div>
                    </section>

                    <section class="tool-card">
                        <h2>Search report details</h2>
                        <p>Use words describing the item to find related posts.</p>

                        <form id="image-text-search">
                            <div class="field">
                                <label for="image-query">Item keywords</label>
                                <input id="image-query" placeholder="e.g. blue bottle, black backpack">
                            </div>

                            <div class="form-actions">
                                <button class="button" type="submit">Search reports</button>
                                <a class="button secondary" href="#browse">Browse all</a>
                            </div>
                        </form>

                        <p class="helper-text">Photo recognition is not active in this version; results use text search.</p>
                    </section>
                </div>

                <section style="margin-top:20px">
                    <div class="section-title-row"><h2>Search results</h2></div>
                    <div class="post-grid" id="image-results">
                        ${allPosts().slice(0, 3).map(postCard).join("")}
                    </div>
                </section>
            </div>
        </div>
    `;
}

function notificationsPage() {
    const items = getNotifications();

    const defaultItems = [
        {
            title: "Welcome to CampusFind",
            message: "Your campus recovery space is ready to explore.",
            date: "Just now"
        },
        {
            title: "Smart matching preview",
            message: "Sample matches are available on the Smart matches page.",
            date: "Today"
        }
    ];

    return `
        <div class="inner-page">
            <div class="page-wrap">
                ${intro("Stay in the loop", "Notifications", "Local demo updates appear here when you create reports or send messages.")}

                <div class="notification-list">
                    ${[...items, ...defaultItems].map(item => `
                        <article class="notification-card">
                            <div class="notification-icon">✦</div>
                            <div>
                                <h3>${escapeHtml(item.title)}</h3>
                                <p>${escapeHtml(item.message)}</p>
                                <p style="margin-top:5px">${escapeHtml(item.date)}</p>
                            </div>
                        </article>
                    `).join("")}
                </div>

                <p class="helper-text" style="margin-top:12px">
                    These notifications are stored only in this browser. Push or real-time notifications require a backend service.
                </p>
            </div>
        </div>
    `;
}

function chatPage() {
    return `
        <div class="inner-page">
            <div class="page-wrap">
                ${intro(
                    "Connect safely",
                    "Campus chat",
                    "A local chat interface prototype for discussing item details. Messages are not sent to other students."
                )}

                <div class="chat-layout">
                    <section class="panel chat-contacts">
                        <button class="chat-contact active" type="button" data-chat="Maya · Blue bottle">
                            <strong>Maya · Blue bottle</strong>
                            <span>Possible item match</span>
                        </button>

                        <button class="chat-contact" type="button" data-chat="Campus help desk">
                            <strong>Campus help desk</strong>
                            <span>General recovery help</span>
                        </button>
                    </section>

                    <section class="chat-card">
                        <div class="chat-heading">
                            <h3 id="chat-title">${escapeHtml(activeChat)}</h3>
                            <p>Demo conversation · Do not share passwords or sensitive personal details</p>
                        </div>

                        <div class="chat-messages" id="chat-messages">
                            ${chatMessages.map(m => `
                                <div class="chat-bubble ${m.mine ? "mine" : ""}">
                                    ${escapeHtml(m.text)}
                                </div>
                            `).join("")}
                        </div>

                        <form class="chat-form" id="chat-form">
                            <input id="chat-input" name="message" placeholder="Write a message…"
                                maxlength="500" required aria-label="Message">
                            <button class="button small" type="submit">Send</button>
                        </form>
                    </section>
                </div>

                <p class="helper-text" style="margin-top:12px">
                    Real private chat requires user accounts, access rules and a backend such as Supabase.
                </p>
            </div>
        </div>
    `;
}

function authPage(mode = "login") {
    const isSignup = mode === "signup";
    const heading = isSignup ? "Create your account" : "Welcome back";
    const description = isSignup
        ? "Join your campus community and keep track of your recovery activity."
        : "Sign in to your CampusFind account.";

    return `
        <div class="inner-page">
            <div class="page-wrap">
                ${intro("Your campus account", isSignup ? "Sign up" : "Sign in", description)}

                <div class="auth-layout">
                    <section class="auth-card">
                        <p class="eyebrow">CampusFind account</p>
                        <h2>${heading}</h2>
                        <p>${isSignup
                            ? "Create an account with your email and a password."
                            : "Use the email and password linked to your account."}</p>

                        <form id="${isSignup ? "signup-form" : "login-form"}">
                            ${isSignup
                                ? `<div class="field">
                                    <label for="signup-name">Full name</label>
                                    <input id="signup-name" name="fullName" type="text"
                                        autocomplete="name" placeholder="Your name"
                                        maxlength="80" required>
                                </div>`
                                : ""}

                            <div class="field">
                                <label for="auth-email">Email</label>
                                <input id="auth-email" name="email" type="email"
                                    autocomplete="email" placeholder="name@campus.edu" required>
                            </div>

                            <div class="field">
                                <label for="auth-password">Password</label>
                                <input id="auth-password" name="password" type="password"
                                    autocomplete="${isSignup ? "new-password" : "current-password"}"
                                    placeholder="${isSignup ? "At least 8 characters" : "Your password"}"
                                    minlength="${isSignup ? "8" : "1"}" required>
                            </div>

                            <button class="button" type="submit">
                                ${isSignup ? "Create account" : "Sign in"}
                            </button>

                            <p class="form-message" id="auth-message"
                                role="status" aria-live="polite" hidden></p>
                        </form>

                        <p class="helper-text">
                            ${isSignup
                                ? 'Already have an account? <a class="text-link" href="#login">Sign in</a>'
                                : 'New to CampusFind? <a class="text-link" href="#signup">Create an account</a>'}
                        </p>

                        ${!supabaseConfigured
                            ? `<p class="helper-text" style="margin-top:12px;color:#a84f35">
                                <strong>Setup required:</strong> Add your Supabase project URL and anon/public key in app.js before authentication can work.
                              </p>`
                            : ""}
                    </section>

                    <aside class="auth-card">
                        <h2>Welcome to CampusFind</h2>
                        <p>Use your account to access the campus recovery experience. Your existing peach-and-terracotta design and other site features remain unchanged.</p>
                        <p class="helper-text">Authentication is handled securely by Supabase. Never share your password with anyone.</p>
                    </aside>
                </div>
            </div>
        </div>
    `;
}

function loginPage() {
    return authPage("login");
}

function showAuthMessage(message, isError = false) {
    const el = document.querySelector("#auth-message");
    if (!el) return;

    el.textContent = message;
    el.style.color = isError ? "#b43f32" : "#35734A";
    el.hidden = false;
}

async function handleAuthSubmit(form) {
    if (!authClient) {
        showAuthMessage(
            "Authentication is not configured yet. Add your Supabase project URL and anon/public key in app.js, then reload.",
            true
        );
        return;
    }

    const data = new FormData(form);
    const email = String(data.get("email") || "").trim();
    const password = String(data.get("password") || "");

    try {
        const result = form.id === "signup-form"
            ? await authClient.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        full_name: String(data.get("fullName") || "").trim()
                    }
                }
            })
            : await authClient.auth.signInWithPassword({ email, password });

        if (result.error) throw result.error;

        if (form.id === "signup-form" && !result.data.session) {
            showAuthMessage(
                "Account created. Check your email for the confirmation link, then sign in."
            );
            return;
        }

        currentAuthUser = result.data.user || null;

        await updateAuthHeader();

        showToast(
            form.id === "signup-form"
                ? "Account created successfully."
                : "Signed in successfully."
        );

        location.hash = "home";
    } catch (error) {
        const message = error?.message || "Authentication failed. Please try again.";
        showAuthMessage(message, true);
    }
}

async function updateAuthHeader() {
    const actions = document.querySelector(".header-actions");
    if (!actions) return;

    if (authClient) {
        const { data } = await authClient.auth.getSession();
        currentAuthUser = data.session?.user || null;
    }

    const existing = actions.querySelector("#auth-action-link");
    if (existing) existing.remove();

    const link = document.createElement("a");
    link.id = "auth-action-link";
    link.className = "login-link";

    if (currentAuthUser) {
        link.href = "#home";
        link.innerHTML = `Sign out <span aria-hidden="true">↗</span>`;

        link.addEventListener("click", async event => {
            event.preventDefault();

            if (authClient) {
                const { error } = await authClient.auth.signOut();

                if (error) {
                    showToast("Could not sign out. Please try again.");
                    return;
                }
            }

            currentAuthUser = null;
            await updateAuthHeader();
            showToast("You have signed out.");
            location.hash = "login";
        });
    } else {
        link.href = "#login";
        link.innerHTML = `Sign in <span aria-hidden="true">↗</span>`;
    }

    actions.append(link);

    const oldLogin = actions.querySelector(".login-link:not(#auth-action-link)");
    if (oldLogin) oldLogin.remove();
}

function currentRoute() {
    return location.hash.slice(1) || "home";
}

function render() {
    const route = currentRoute();
    const page = route.split("/")[0];

    document.querySelectorAll("[data-nav]").forEach(link => {
        const active = link.dataset.nav === page;
        link.classList.toggle("active", active);

        if (active) {
            link.setAttribute("aria-current", "page");
        } else {
            link.removeAttribute("aria-current");
        }
    });

    if (route === "home") app.innerHTML = homePage();
    else if (route === "browse") app.innerHTML = browsePage();
    else if (route === "matches") app.innerHTML = matchesPage();
    else if (route === "dashboard") app.innerHTML = dashboardPage();
    else if (route === "image-search") app.innerHTML = imageSearchPage();
    else if (route === "notifications") app.innerHTML = notificationsPage();
    else if (route === "chat") app.innerHTML = chatPage();
    else if (route === "my-posts") app.innerHTML = myPostsPage();
    else if (route === "my-requests") app.innerHTML = requestsPage();
    else if (route === "report-lost") app.innerHTML = reportPage("Lost");
    else if (route === "report-found") app.innerHTML = reportPage("Found");
    else if (route === "login") app.innerHTML = loginPage();
    else if (route === "signup") app.innerHTML = authPage("signup");
    else if (page === "post") {
        app.innerHTML = postDetails(
            decodeURIComponent(route.slice("post/".length))
        );
    } else {
        app.innerHTML = homePage();
    }

    if (route === "browse") {
        renderBrowseResults();

        ["#post-search", "#post-category", "#post-type"].forEach(selector => {
            const element = document.querySelector(selector);
            if (element) {
                element.addEventListener(
                    selector === "#post-search" ? "input" : "change",
                    renderBrowseResults
                );
            }
        });
    }

    if (route === "image-search") {
        const fileInput = document.querySelector("#image-search-file");

        if (fileInput) {
            fileInput.addEventListener("change", () => {
                const file = fileInput.files?.[0];
                const wrap = document.querySelector("#image-preview-wrap");

                if (!file || !wrap) return;

                if (!file.type.startsWith("image/")) {
                    showToast("Please choose an image file.");
                    return;
                }

                const reader = new FileReader();

                reader.onload = () => {
                    wrap.innerHTML = `
                        <img class="preview-image"
                            alt="Selected item preview"
                            src="${reader.result}">
                    `;
                    showToast("Image preview ready. Visual AI search is not connected yet.");
                };

                reader.readAsDataURL(file);
            });
        }

        const searchForm = document.querySelector("#image-text-search");

        if (searchForm) {
            searchForm.addEventListener("submit", event => {
                event.preventDefault();

                const q = document.querySelector("#image-query").value.trim().toLowerCase();

                const found = allPosts().filter(p =>
                    [p.title, p.description, p.category, p.location]
                        .join(" ")
                        .toLowerCase()
                        .includes(q)
                );

                const results = document.querySelector("#image-results");

                if (results) {
                    results.innerHTML = found.length
                        ? found.map(postCard).join("")
                        : `<div class="empty-card" style="grid-column:1/-1">
                            <h2>No text matches</h2>
                            <p>Try different keywords.</p>
                           </div>`;
                }
            });
        }
    }

    if (route === "chat") {
        document.querySelectorAll("[data-chat]").forEach(button => {
            button.addEventListener("click", () => {
                activeChat = button.dataset.chat;

                document.querySelectorAll(".chat-contact").forEach(el => {
                    el.classList.toggle("active", el === button);
                });

                const title = document.querySelector("#chat-title");
                if (title) title.textContent = activeChat;
            });
        });
    }

    if (app) app.focus({ preventScroll: true });
    updateNotificationCount();
}

function showToast(message) {
    if (!toast) return;

    toast.textContent = message;
    toast.classList.add("show");

    window.clearTimeout(toastTimer);

    toastTimer = window.setTimeout(() => {
        toast.classList.remove("show");
    }, 3200);
}

document.addEventListener("submit", event => {
    const form = event.target;

    if (!(form instanceof HTMLFormElement)) return;

    if (form.id === "report-form") {
        event.preventDefault();

        const data = new FormData(form);
        const dateValue = String(data.get("date"));

        const formattedDate = new Date(`${dateValue}T12:00:00`)
            .toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric"
            });

        const post = {
            id: `report-${Date.now()}`,
            type: form.dataset.type,
            title: String(data.get("title")).trim(),
            description: String(data.get("description")).trim(),
            category: String(data.get("category")),
            location: String(data.get("location")).trim(),
            date: formattedDate
        };

        try {
            localStorage.setItem(
                "campusfind-posts",
                JSON.stringify([post, ...getUserPosts()])
            );
        } catch (error) {
            console.error("Could not save report.", error);
            showToast("Report couldn't be saved in this browser.");
            return;
        }

        addNotification(
            "Report published",
            `Your ${post.type.toLowerCase()} report “${post.title}” was saved on this device.`
        );

        location.hash = "my-posts";
        showToast("Report saved on this device.");
    }

    if (form.id === "login-form" || form.id === "signup-form") {
        event.preventDefault();
        void handleAuthSubmit(form);
    }

    if (form.id === "claim-form") {
        event.preventDefault();

        const post = allPosts().find(p => p.id === form.dataset.postId);

        const request = {
            title: `Claim request: ${post?.title || "Campus item"}`,
            message: "Local demo request created. Ownership has not been verified.",
            date: new Date().toLocaleString()
        };

        let requests = [];

        try {
            requests = JSON.parse(
                localStorage.getItem("campusfind-requests") || "[]"
            );
        } catch {}

        requests.unshift(request);

        try {
            localStorage.setItem("campusfind-requests", JSON.stringify(requests));
        } catch {}

        addNotification("Claim request started", request.message);
        showToast("Demo claim request saved.");
        location.hash = "my-requests";
    }

    if (form.id === "chat-form") {
        event.preventDefault();

        const input = document.querySelector("#chat-input");
        if (!input) return;

        const value = input.value.trim();
        if (!value) return;

        chatMessages.push({ mine: true, text: value });

        addNotification(
            "Chat message saved",
            `Your demo message to ${activeChat} was saved in this page session.`
        );

        const messages = document.querySelector("#chat-messages");

        if (messages) {
            messages.innerHTML = chatMessages.map(m => `
                <div class="chat-bubble ${m.mine ? "mine" : ""}">
                    ${escapeHtml(m.text)}
                </div>
            `).join("");
        }

        input.value = "";
        showToast("Message added to the local demo chat.");
    }
});

window.addEventListener("hashchange", render);

render();