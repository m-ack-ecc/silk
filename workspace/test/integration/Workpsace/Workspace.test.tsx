import React from "react";
import qs from "qs";
import { createBrowserHistory } from "history";
import mockAxios from "../../__mocks__/axios";
import { testWrapper, workspacePath } from "../TestHelper";
import { Workspace } from "../../../src/app/views/pages/Workspace/Workspace";

describe("Search Items", () => {
    let hostPath = process.env.HOST;
    afterEach(() => {
        mockAxios.reset();
    });

    it("should filter items, by given criteria from URL search params", async () => {
        const filteredQueryParams = qs.stringify(
            {
                textQuery: "some text",
                itemType: "dataset",
                limit: 15,
                page: 2,
                f_ids: ["facetId1", "facetId2"],
                f_keys: ["facet1Key1|facet1Key2", "facet2Key"],
                types: ["keyword", "keyword"],
            },
            { arrayFormat: "comma" }
        );

        let history = createBrowserHistory();
        history.location.pathname = workspacePath("");
        history.location.search = filteredQueryParams;

        testWrapper(<Workspace />, history);

        const reqInfo = mockAxios.getReqMatching({
            url: hostPath + "/api/workspace/searchItems",
        });
        expect(reqInfo.data).toEqual({
            textQuery: "some text",
            itemType: "dataset",
            limit: 15,
            offset: 10,
            facets: [
                { facetId: "facetId1", type: "keyword", keywordIds: ["facet1Key1", "facet1Key2"] },
                { facetId: "facetId2", type: "keyword", keywordIds: ["facet2Key"] },
            ],
        });
    });
});
