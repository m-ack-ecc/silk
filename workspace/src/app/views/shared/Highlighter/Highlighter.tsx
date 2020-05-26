import React from "react";

/** Escapes strings to match literally.
 *  taken from https://stackoverflow.com/questions/6318710/javascript-equivalent-of-perls-q-e-or-quotemeta
 */
const escapeRegexWord = (str: string) => {
    return str.toLowerCase().replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
};

/**
 * Returns a highlighted string according to the words of the search query.
 * @param label       The string to highlight.
 * @param searchValue The mutli-word search query from which single words should be highlighted in the label.
 */
const getSearchHighlight = (label: string, searchValue: string) => {
    if (!searchValue) {
        return label;
    }

    const searchStringParts = searchValue.split(RegExp("\\s+")).filter((word) => word !== "");
    if (searchStringParts.length === 0) {
        return label;
    }
    const validString = searchStringParts.map(escapeRegexWord).join("|");
    const multiWordRegex = RegExp(validString, "gi");
    const result = [];

    let offset = 0;
    // loop through matches and add unmatched and matched parts to result array
    let matchArray = multiWordRegex.exec(label);
    let key = 0;
    while (matchArray !== null) {
        key++;
        result.push(label.slice(offset, matchArray.index));
        result.push(<mark key={key}>{matchArray[0]}</mark>);
        offset = multiWordRegex.lastIndex;
        matchArray = multiWordRegex.exec(label);
    }
    // Add remaining unmatched string
    result.push(label.slice(offset));
    return result;
};

export function Highlighter({ label, searchValue }) {
    return <span>{getSearchHighlight(label, searchValue)}</span>;
}
