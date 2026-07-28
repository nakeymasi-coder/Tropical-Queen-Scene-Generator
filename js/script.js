"use strict";

document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("prompt-generator-form");
    const categoryPanels = Array.from(
        document.querySelectorAll(".category-panel")
    );
    const navigationButtons = Array.from(
        document.querySelectorAll(".category-nav-button")
    );
    const chipGroups = Array.from(
        document.querySelectorAll(".chip-group[data-multi-select='true']")
    );

    const randomizeButton = document.getElementById("randomize-all-btn");
    const generateButton = document.getElementById("generate-prompt-btn");
    const outputGenerateButton = document.getElementById(
        "generate-prompt-output-btn"
    );
    const clearAllButton = document.getElementById("clear-all-btn");
    const copyButton = document.getElementById("copy-prompt-btn");

    const promptOutput = document.getElementById("prompt-output");
    const outputStatus = document.getElementById("output-status");
    const validationSummary = document.getElementById("validation-summary");
    const qualityResult = document.getElementById("quality-result");
    const updateNeededMessage = document.getElementById(
        "update-needed-message"
    );

    const toast = document.getElementById("toast");
    const toastMessage = document.getElementById("toast-message");

    const state = {
        lockedCategories: new Set(),
        generatedPrompt: "",
        hasGeneratedPrompt: false,
        toastTimer: null
    };

    const requiredFieldLabels = {
        "character-count": "Number of Women",
        "ethnicity-heritage": "Ethnicity or Heritage",
        "island-influence": "Island or Regional Influence",
        "celebration-type": "Celebration or Festival",
        "outfit-category": "Outfit Category",
        "background-location": "Background Location",
        "art-style": "Art Style",
        "shot-type": "Shot Type",
        orientation: "Image Orientation"
    };

    const randomizeSettings = {
        facialFeatures: { minimum: 1, maximum: 3 },
        makeup: { minimum: 1, maximum: 4 },
        costumeDetails: { minimum: 2, maximum: 5 },
        jewelry: { minimum: 0, maximum: 3 },
        atmosphericDetails: { minimum: 0, maximum: 4 }
    };

    function initialize() {
        initializeNavigation();
        initializeChipGroups();
        initializeCategoryLocks();
        initializeClearCategoryButtons();
        initializeFormTracking();
        initializeMainActions();
        synchronizeAllChipGroups();
        updateGroupDependentControls();
        setEmptyOutput();
    }

    function initializeNavigation() {
        navigationButtons.forEach((button) => {
            button.addEventListener("click", () => {
                const targetPanelId = button.dataset.targetPanel;
                showPanel(targetPanelId);
            });

            button.addEventListener("keydown", (event) => {
                const currentIndex = navigationButtons.indexOf(button);
                let nextIndex = null;

                if (event.key === "ArrowRight" || event.key === "ArrowDown") {
                    nextIndex = (currentIndex + 1) % navigationButtons.length;
                }

                if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
                    nextIndex =
                        (currentIndex - 1 + navigationButtons.length) %
                        navigationButtons.length;
                }

                if (event.key === "Home") {
                    nextIndex = 0;
                }

                if (event.key === "End") {
                    nextIndex = navigationButtons.length - 1;
                }

                if (nextIndex !== null) {
                    event.preventDefault();
                    const nextButton = navigationButtons[nextIndex];
                    nextButton.focus();
                    showPanel(nextButton.dataset.targetPanel);
                }
            });
        });
    }

    function showPanel(panelId) {
        navigationButtons.forEach((button) => {
            const isActive = button.dataset.targetPanel === panelId;

            button.classList.toggle("active", isActive);
            button.setAttribute("aria-selected", String(isActive));
            button.tabIndex = isActive ? 0 : -1;
        });

        categoryPanels.forEach((panel) => {
            const isActive = panel.id === panelId;

            panel.hidden = !isActive;
            panel.classList.toggle("active", isActive);
        });
    }

    function initializeChipGroups() {
        chipGroups.forEach((group) => {
            const chips = Array.from(
                group.querySelectorAll(".option-chip[data-value]")
            );

            chips.forEach((chip) => {
                chip.setAttribute("aria-pressed", "false");

                chip.addEventListener("click", () => {
                    toggleChip(group, chip);
                });

                chip.addEventListener("keydown", (event) => {
                    if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        toggleChip(group, chip);
                    }
                });
            });
        });
    }

    function toggleChip(group, chip) {
        if (chip.disabled) {
            return;
        }

        const maximum = Number(group.dataset.maxSelections || 1);
        const isSelected = chip.classList.contains("selected");
        const selectedChips = getSelectedChips(group);

        if (!isSelected && selectedChips.length >= maximum) {
            showToast(
                `You can choose up to ${maximum} options in this section.`,
                "warning"
            );
            return;
        }

        setChipSelected(chip, !isSelected);
        synchronizeChipGroup(group);
        markPromptAsOutdated();
    }

    function setChipSelected(chip, selected) {
        chip.classList.toggle("selected", selected);
        chip.setAttribute("aria-pressed", String(selected));
    }

    function getSelectedChips(group) {
        return Array.from(group.querySelectorAll(".option-chip.selected"));
    }

    function synchronizeChipGroup(group) {
        const hiddenInput = group.parentElement.querySelector(
            "input[type='hidden'][data-field-key]"
        );

        if (!hiddenInput) {
            return;
        }

        const values = getSelectedChips(group).map(
            (chip) => chip.dataset.value
        );

        hiddenInput.value = values.join("|");
        hiddenInput.dispatchEvent(
            new Event("change", {
                bubbles: true
            })
        );
    }

    function synchronizeAllChipGroups() {
        chipGroups.forEach(synchronizeChipGroup);
    }

    function initializeCategoryLocks() {
        const lockButtons = Array.from(
            document.querySelectorAll(".lock-category-button")
        );

        lockButtons.forEach((button) => {
            button.addEventListener("click", () => {
                const category = button.dataset.lockCategory;
                toggleCategoryLock(category, button);
            });
        });
    }

    function toggleCategoryLock(category, button) {
        const panel = getCategoryPanel(category);

        if (!panel) {
            return;
        }

        const isLocked = state.lockedCategories.has(category);

        if (isLocked) {
            state.lockedCategories.delete(category);
            button.setAttribute("aria-pressed", "false");
            button.textContent = "Lock";
            button.classList.remove("locked");
            panel.classList.remove("is-locked");
            showToast("Category unlocked.", "success");
        } else {
            state.lockedCategories.add(category);
            button.setAttribute("aria-pressed", "true");
            button.textContent = "Unlock";
            button.classList.add("locked");
            panel.classList.add("is-locked");
            showToast("Category locked.", "success");
        }
    }

    function getCategoryPanel(category) {
        return document.querySelector(
            `.category-panel[data-category="${category}"]`
        );
    }

    function initializeClearCategoryButtons() {
        const clearButtons = Array.from(
            document.querySelectorAll(".clear-category-button")
        );

        clearButtons.forEach((button) => {
            button.addEventListener("click", () => {
                const category = button.dataset.clearCategory;
                clearCategory(category);
            });
        });
    }

    function clearCategory(category) {
        const panel = getCategoryPanel(category);

        if (!panel) {
            return;
        }

        if (state.lockedCategories.has(category)) {
            showToast(
                "Unlock this category before clearing it.",
                "warning"
            );
            return;
        }

        resetControlsInside(panel);
        clearValidationStyles(panel);
        updateGroupDependentControls();
        markPromptAsOutdated();
        showToast("Category cleared.", "success");
    }

    function resetControlsInside(container) {
        const selects = Array.from(container.querySelectorAll("select"));
        const textareas = Array.from(container.querySelectorAll("textarea"));
        const textInputs = Array.from(
            container.querySelectorAll("input[type='text']")
        );
        const hiddenInputs = Array.from(
            container.querySelectorAll("input[type='hidden']")
        );
        const chips = Array.from(container.querySelectorAll(".option-chip"));

        selects.forEach((select) => {
            select.selectedIndex = 0;
        });

        textareas.forEach((textarea) => {
            textarea.value = "";
        });

        textInputs.forEach((input) => {
            input.value = "";
        });

        hiddenInputs.forEach((input) => {
            input.value = "";
        });

        chips.forEach((chip) => {
            setChipSelected(chip, false);
        });
    }

    function initializeFormTracking() {
        form.addEventListener("input", (event) => {
            if (event.target.matches("textarea, input, select")) {
                clearFieldError(event.target);
                markPromptAsOutdated();
            }
        });

        form.addEventListener("change", (event) => {
            if (event.target.id === "character-count") {
                updateGroupDependentControls();
            }

            if (event.target.matches("textarea, input, select")) {
                clearFieldError(event.target);
                markPromptAsOutdated();
            }
        });
    }

    function initializeMainActions() {
        randomizeButton.addEventListener("click", randomizeGenerator);
        generateButton.addEventListener("click", generatePrompt);
        outputGenerateButton.addEventListener("click", generatePrompt);
        clearAllButton.addEventListener("click", clearAll);
        copyButton.addEventListener("click", copyPrompt);
    }

    function randomizeGenerator() {
        setButtonLoading(randomizeButton, true);

        window.setTimeout(() => {
            categoryPanels.forEach((panel) => {
                const category = panel.dataset.category;

                if (state.lockedCategories.has(category)) {
                    return;
                }

                randomizePanel(panel);
            });

            updateGroupDependentControls();
            markPromptAsOutdated();
            setButtonLoading(randomizeButton, false);
            showToast(
                state.lockedCategories.size > 0
                    ? "Unlocked categories randomized."
                    : "Selections randomized.",
                "success"
            );
        }, 180);
    }

    function randomizePanel(panel) {
        const selects = Array.from(panel.querySelectorAll("select"));
        const groups = Array.from(
            panel.querySelectorAll(
                ".chip-group[data-multi-select='true']"
            )
        );

        selects.forEach((select) => {
            if (select.disabled) {
                return;
            }

            randomizeSelect(select);
        });

        groups.forEach((group) => {
            randomizeChipGroup(group);
        });
    }

    function randomizeSelect(select) {
        const availableOptions = Array.from(select.options).filter(
            (option) => option.value && !option.disabled
        );

        if (availableOptions.length === 0) {
            select.selectedIndex = 0;
            return;
        }

        if (
            select.id === "group-arrangement" &&
            getValue("characterCount") === "one adult woman"
        ) {
            const soloOption = availableOptions.find((option) =>
                option.value.includes("single confident focal subject")
            );

            if (soloOption) {
                select.value = soloOption.value;
                return;
            }
        }

        if (
            select.id === "interaction" &&
            getValue("characterCount") === "one adult woman"
        ) {
            select.selectedIndex = 0;
            return;
        }

        const optionalNoneAllowed =
            !select.required &&
            select.options.length > 0 &&
            select.options[0].value === "";

        if (optionalNoneAllowed && Math.random() < 0.16) {
            select.selectedIndex = 0;
            return;
        }

        const randomOption =
            availableOptions[
                Math.floor(Math.random() * availableOptions.length)
            ];

        select.value = randomOption.value;
    }

    function randomizeChipGroup(group) {
        const hiddenInput = group.parentElement.querySelector(
            "input[type='hidden'][data-field-key]"
        );
        const fieldKey = hiddenInput?.dataset.fieldKey || "";
        const settings = randomizeSettings[fieldKey] || {
            minimum: 0,
            maximum: Number(group.dataset.maxSelections || 1)
        };

        const chips = Array.from(
            group.querySelectorAll(".option-chip[data-value]")
        );

        chips.forEach((chip) => setChipSelected(chip, false));

        const maximum = Math.min(
            settings.maximum,
            Number(group.dataset.maxSelections || settings.maximum),
            chips.length
        );

        const minimum = Math.min(settings.minimum, maximum);
        const count =
            minimum +
            Math.floor(Math.random() * (maximum - minimum + 1));

        shuffleArray(chips)
            .slice(0, count)
            .forEach((chip) => setChipSelected(chip, true));

        synchronizeChipGroup(group);
    }

    function shuffleArray(items) {
        const copy = [...items];

        for (let index = copy.length - 1; index > 0; index -= 1) {
            const randomIndex = Math.floor(Math.random() * (index + 1));
            [copy[index], copy[randomIndex]] = [
                copy[randomIndex],
                copy[index]
            ];
        }

        return copy;
    }

    function updateGroupDependentControls() {
        const count = getValue("characterCount");
        const groupArrangement = document.getElementById(
            "group-arrangement"
        );
        const interaction = document.getElementById("interaction");

        const isSolo = count === "one adult woman";

        if (groupArrangement) {
            Array.from(groupArrangement.options).forEach((option) => {
                if (!option.value) {
                    return;
                }

                const soloSpecific = option.value.includes(
                    "single confident focal subject"
                );

                option.disabled = isSolo ? !soloSpecific : soloSpecific;
            });

            if (
                groupArrangement.selectedOptions[0]?.disabled ||
                (!isSolo &&
                    groupArrangement.value.includes(
                        "single confident focal subject"
                    ))
            ) {
                groupArrangement.selectedIndex = 0;
            }
        }

        if (interaction) {
            interaction.disabled = isSolo;

            if (isSolo) {
                interaction.selectedIndex = 0;
            }
        }
    }

    function validateForm() {
        clearAllValidationStyles();

        const missingFields = [];

        Object.entries(requiredFieldLabels).forEach(
            ([fieldId, fieldLabel]) => {
                const field = document.getElementById(fieldId);

                if (!field || !String(field.value).trim()) {
                    missingFields.push({
                        field,
                        label: fieldLabel
                    });

                    if (field) {
                        markFieldError(field);
                    }
                }
            }
        );

        if (missingFields.length > 0) {
            const labels = missingFields.map((item) => item.label);

            showValidation(
                `Please complete the required choices before generating your prompt: ${formatList(
                    labels
                )}.`,
                "error"
            );

            const firstMissingField = missingFields[0].field;

            if (firstMissingField) {
                const panel = firstMissingField.closest(".category-panel");

                if (panel) {
                    showPanel(panel.id);
                }

                window.setTimeout(() => {
                    firstMissingField.focus();
                }, 50);
            }

            return false;
        }

        const count = getValue("characterCount");
        const groupArrangement = getValue("groupArrangement");
        const interaction = getValue("interaction");

        if (
            count === "one adult woman" &&
            (isGroupOnlyText(groupArrangement) ||
                isGroupOnlyText(interaction))
        ) {
            showValidation(
                "Choose a group arrangement only when two or more women are selected.",
                "error"
            );
            showPanel("character-panel");
            return false;
        }

        hideValidation();
        return true;
    }

    function isGroupOnlyText(value) {
        if (!value) {
            return false;
        }

        const normalized = value.toLowerCase();

        return [
            "together",
            "friends",
            "group",
            "one another",
            "troupe",
            "lineup",
            "formation"
        ].some((word) => normalized.includes(word));
    }

    function generatePrompt() {
        if (!validateForm()) {
            showToast(
                "Please complete the required choices.",
                "error"
            );
            return;
        }

        setGenerateLoading(true);

        window.setTimeout(() => {
            const prompt = assemblePrompt();

            state.generatedPrompt = prompt;
            state.hasGeneratedPrompt = true;

            renderPrompt(prompt);
            renderQualityResult(prompt);
            hideValidation();
            updateNeededMessage.hidden = true;
            setGenerateLoading(false);
            showToast("Your prompt is ready.", "success");
        }, 220);
    }

    function assemblePrompt() {
        const count = getValue("characterCount");
        const isSolo = count === "one adult woman";

        const subjectParts = [
            count,
            getValue("ageRange"),
            getValue("ethnicityHeritage"),
            getValue("skinTone"),
            getValue("bodyType")
        ];

        const facialFeatures = getMultiValues("facialFeatures");
        const characterCustom = getValue("characterCustomDetails");

        const sceneParts = [
            getValue("celebrationType"),
            getValue("islandInfluence")
                ? `inspired by ${getValue("islandInfluence")}`
                : "",
            getValue("sceneContext"),
            getValue("culturalDirection"),
            getValue("themeCustomDetails")
        ];

        const hairBeautyParts = [
            getValue("hairLength"),
            getValue("hairStyle"),
            getValue("hairColor"),
            getValue("hairAccessory"),
            ...getMultiValues("makeup"),
            getValue("eyelashes"),
            getValue("nailStyle"),
            getValue("bodyDecoration"),
            getValue("beautyCustomDetails")
        ];

        const clothingParts = [
            getValue("outfitCategory"),
            getValue("outfitSilhouette"),
            ...getMultiValues("costumeDetails"),
            getValue("shoeStyle"),
            ...getMultiValues("jewelry"),
            getValue("prop"),
            getValue("clothingCustomDetails")
        ];

        const poseParts = [
            getValue("groupArrangement"),
            getValue("pose"),
            getValue("movement"),
            getValue("facialExpression"),
            getValue("eyeDirection"),
            isSolo ? "" : getValue("interaction"),
            getValue("energyLevel"),
            getValue("poseCustomDetails")
        ];

        const backgroundParts = [
            getValue("backgroundLocation"),
            getValue("crowdPresence"),
            getValue("timeOfDay"),
            getValue("weather"),
            ...getMultiValues("atmosphericDetails"),
            getValue("backgroundCustomDetails")
        ];

        const styleParts = [
            getValue("artStyle"),
            getValue("realismLevel"),
            getValue("mood"),
            getValue("colorPalette"),
            getValue("lighting"),
            getValue("depthStyle"),
            getValue("styleCustomDetails")
        ];

        const cameraParts = [
            getValue("shotType"),
            getValue("cameraAngle"),
            getValue("composition"),
            getValue("orientation"),
            getValue("imageQuality"),
            getValue("renderingPriority"),
            getValue("finalCustomDetails")
        ];

        const subjectSentence = buildSubjectSentence(
            subjectParts,
            facialFeatures,
            characterCustom
        );

        const sentences = [
            subjectSentence,
            buildSentence(
                "Create the scene around",
                sceneParts
            ),
            buildSentence(
                isSolo
                    ? "Style her with"
                    : "Style the women with",
                hairBeautyParts
            ),
            buildSentence(
                isSolo
                    ? "Dress her in"
                    : "Dress them in",
                clothingParts
            ),
            buildSentence(
                "Show the subject",
                poseParts
            ),
            buildSentence(
                "Place the scene in",
                backgroundParts
            ),
            buildSentence(
                "Use",
                styleParts
            ),
            buildSentence(
                "Frame the image as",
                cameraParts
            ),
            "Maintain believable adult anatomy, natural proportions, cohesive lighting, culturally respectful details, one clear focal direction, and a polished professional finish."
        ];

        return cleanPrompt(sentences.filter(Boolean).join(" "));
    }

    function buildSubjectSentence(
        subjectParts,
        facialFeatures,
        customDetails
    ) {
        const cleanSubjectParts = uniqueValues(subjectParts);
        const subjectDescription = formatList(cleanSubjectParts);

        const additionalDetails = [];

        if (facialFeatures.length > 0) {
            additionalDetails.push(
                `featuring ${formatList(facialFeatures)}`
            );
        }

        if (customDetails) {
            additionalDetails.push(customDetails);
        }

        let sentence = `Create an original Caribbean-themed image featuring ${subjectDescription}`;

        if (additionalDetails.length > 0) {
            sentence += `, ${additionalDetails.join(", ")}`;
        }

        return ensureSentence(sentence);
    }

    function buildSentence(prefix, values) {
        const cleaned = uniqueValues(values);

        if (cleaned.length === 0) {
            return "";
        }

        return ensureSentence(`${prefix} ${formatList(cleaned)}`);
    }

    function cleanPrompt(prompt) {
        return prompt
            .replace(/\s+/g, " ")
            .replace(/\s+,/g, ",")
            .replace(/,\s*,+/g, ",")
            .replace(/\.\s*\./g, ".")
            .replace(/\s+\./g, ".")
            .trim();
    }

    function ensureSentence(text) {
        const cleaned = cleanPrompt(text);

        if (!cleaned) {
            return "";
        }

        return /[.!?]$/.test(cleaned) ? cleaned : `${cleaned}.`;
    }

    function uniqueValues(values) {
        const seen = new Set();

        return values
            .flat()
            .map((value) => String(value || "").trim())
            .filter(Boolean)
            .filter((value) => {
                const normalized = value.toLowerCase();

                if (seen.has(normalized)) {
                    return false;
                }

                seen.add(normalized);
                return true;
            });
    }

    function formatList(values) {
        const cleaned = uniqueValues(values);

        if (cleaned.length === 0) {
            return "";
        }

        if (cleaned.length === 1) {
            return cleaned[0];
        }

        if (cleaned.length === 2) {
            return `${cleaned[0]} and ${cleaned[1]}`;
        }

        return `${cleaned.slice(0, -1).join(", ")}, and ${
            cleaned[cleaned.length - 1]
        }`;
    }

    function getValue(fieldKey) {
        const field = form.querySelector(
            `[data-field-key="${fieldKey}"]`
        );

        return field ? String(field.value || "").trim() : "";
    }

    function getMultiValues(fieldKey) {
        const value = getValue(fieldKey);

        if (!value) {
            return [];
        }

        return value
            .split("|")
            .map((item) => item.trim())
            .filter(Boolean);
    }

    function renderPrompt(prompt) {
        promptOutput.classList.remove("empty");
        promptOutput.textContent = prompt;

        outputStatus.textContent = "Generated";
        outputStatus.className = "output-status success";

        copyButton.disabled = false;
    }

    function setEmptyOutput() {
        promptOutput.classList.add("empty");
        promptOutput.innerHTML =
            '<p class="empty-state" id="prompt-empty-state">Your polished Caribbean image prompt will appear here.</p>';

        outputStatus.textContent = "Not generated";
        outputStatus.className = "output-status";

        copyButton.disabled = true;
        qualityResult.hidden = true;
        qualityResult.textContent = "";
        qualityResult.className = "quality-result";
        updateNeededMessage.hidden = true;
    }

    function renderQualityResult(prompt) {
        const requiredCount = Object.keys(requiredFieldLabels).length;
        const completedRequiredCount = Object.keys(
            requiredFieldLabels
        ).filter((id) => {
            const element = document.getElementById(id);
            return element && String(element.value).trim();
        }).length;

        const wordCount = prompt
            .split(/\s+/)
            .filter(Boolean).length;

        const hasSubject = Boolean(getValue("characterCount"));
        const hasCulture =
            Boolean(getValue("islandInfluence")) &&
            Boolean(getValue("celebrationType"));
        const hasWardrobe = Boolean(getValue("outfitCategory"));
        const hasBackground = Boolean(
            getValue("backgroundLocation")
        );
        const hasStyle = Boolean(getValue("artStyle"));
        const hasComposition =
            Boolean(getValue("shotType")) &&
            Boolean(getValue("orientation"));

        const qualityChecks = [
            completedRequiredCount === requiredCount,
            hasSubject,
            hasCulture,
            hasWardrobe,
            hasBackground,
            hasStyle,
            hasComposition,
            wordCount >= 80
        ];

        const passedChecks = qualityChecks.filter(Boolean).length;

        qualityResult.hidden = false;

        if (passedChecks === qualityChecks.length) {
            qualityResult.className = "quality-result success";
            qualityResult.textContent =
                "Prompt quality check: Complete, detailed, and ready to copy.";
            return;
        }

        if (passedChecks >= qualityChecks.length - 2) {
            qualityResult.className = "quality-result warning";
            qualityResult.textContent =
                "Prompt quality check: Ready to use. Add more optional details for a richer result.";
            return;
        }

        qualityResult.className = "quality-result error";
        qualityResult.textContent =
            "Prompt quality check: Add more scene, styling, or composition details before copying.";
    }

    function markPromptAsOutdated() {
        if (!state.hasGeneratedPrompt) {
            return;
        }

        updateNeededMessage.hidden = false;
        outputStatus.textContent = "Update needed";
        outputStatus.className = "output-status warning";
    }

    async function copyPrompt() {
        if (!state.generatedPrompt) {
            showToast("Generate a prompt before copying.", "warning");
            return;
        }

        try {
            await navigator.clipboard.writeText(state.generatedPrompt);
            showToast("Prompt copied.", "success");
        } catch (error) {
            const copied = fallbackCopy(state.generatedPrompt);

            if (copied) {
                showToast("Prompt copied.", "success");
            } else {
                showToast(
                    "The prompt could not be copied automatically.",
                    "error"
                );
            }
        }
    }

    function fallbackCopy(text) {
        const temporaryTextarea = document.createElement("textarea");

        temporaryTextarea.value = text;
        temporaryTextarea.setAttribute("readonly", "");
        temporaryTextarea.style.position = "fixed";
        temporaryTextarea.style.opacity = "0";
        temporaryTextarea.style.pointerEvents = "none";

        document.body.appendChild(temporaryTextarea);
        temporaryTextarea.select();
        temporaryTextarea.setSelectionRange(0, text.length);

        let successful = false;

        try {
            successful = document.execCommand("copy");
        } catch (error) {
            successful = false;
        }

        temporaryTextarea.remove();
        return successful;
    }

    function clearAll() {
        resetControlsInside(form);

        state.lockedCategories.clear();
        state.generatedPrompt = "";
        state.hasGeneratedPrompt = false;

        document
            .querySelectorAll(".lock-category-button")
            .forEach((button) => {
                button.setAttribute("aria-pressed", "false");
                button.textContent = "Lock";
                button.classList.remove("locked");
            });

        categoryPanels.forEach((panel) => {
            panel.classList.remove("is-locked");
        });

        clearAllValidationStyles();
        hideValidation();
        updateGroupDependentControls();
        setEmptyOutput();
        showPanel("character-panel");

        showToast("Generator cleared.", "success");
    }

    function markFieldError(field) {
        const formField = field.closest(".form-field");

        if (formField) {
            formField.classList.add("has-error");
        }

        field.setAttribute("aria-invalid", "true");
    }

    function clearFieldError(field) {
        const formField = field.closest(".form-field");

        if (formField) {
            formField.classList.remove("has-error");
        }

        field.removeAttribute("aria-invalid");
    }

    function clearValidationStyles(container) {
        container
            .querySelectorAll(".form-field.has-error")
            .forEach((field) => {
                field.classList.remove("has-error");
            });

        container
            .querySelectorAll("[aria-invalid='true']")
            .forEach((field) => {
                field.removeAttribute("aria-invalid");
            });
    }

    function clearAllValidationStyles() {
        clearValidationStyles(form);
    }

    function showValidation(message, type = "error") {
        validationSummary.hidden = false;
        validationSummary.textContent = message;
        validationSummary.className = "validation-summary";

        if (type !== "error") {
            validationSummary.classList.add(type);
        }

        validationSummary.scrollIntoView({
            behavior: prefersReducedMotion() ? "auto" : "smooth",
            block: "center"
        });
    }

    function hideValidation() {
        validationSummary.hidden = true;
        validationSummary.textContent = "";
        validationSummary.className = "validation-summary";
    }

    function showToast(message, type = "") {
        if (state.toastTimer) {
            window.clearTimeout(state.toastTimer);
        }

        toast.hidden = false;
        toast.className = "toast";

        if (type) {
            toast.classList.add(type);
        }

        toastMessage.textContent = message;

        state.toastTimer = window.setTimeout(() => {
            toast.hidden = true;
            toastMessage.textContent = "";
            toast.className = "toast";
        }, 2800);
    }

    function setGenerateLoading(loading) {
        setButtonLoading(generateButton, loading);
        setButtonLoading(outputGenerateButton, loading);
    }

    function setButtonLoading(button, loading) {
        if (!button) {
            return;
        }

        button.classList.toggle("is-loading", loading);
        button.disabled = loading;
        button.setAttribute("aria-busy", String(loading));
    }

    function prefersReducedMotion() {
        return window.matchMedia(
            "(prefers-reduced-motion: reduce)"
        ).matches;
    }

    initialize();
});