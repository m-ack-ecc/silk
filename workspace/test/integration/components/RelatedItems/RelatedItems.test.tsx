import React from "react";
import "@testing-library/jest-dom";
import { createBrowserHistory, History, LocationState } from "history";
import mockAxios from "../../../__mocks__/axios";
import {
    checkRequestMade,
    findAll,
    findSingleElement,
    logWrapperHtml,
    mockedAxiosResponse,
    testWrapper,
    withMount,
    workspacePath,
} from "../../TestHelper";
import { RelatedItems } from "../../../../src/app/views/shared/RelatedItems/RelatedItems";
import { RelatedItemsTestHelper } from "./RelatedItemsTestHelper";
import { SERVE_PATH } from "../../../../src/app/constants/path";
import { ReactWrapper } from "enzyme";
import { waitFor } from "@testing-library/react";

describe("Related items", () => {
    let hostPath = process.env.HOST;
    let history: History<LocationState> = null;
    beforeAll(() => {
        loadRelatedItems();
    })
    afterEach(() => {
        mockAxios.reset();
    });

    it("should display related items according to the project ID and task ID from the URL", async () => {
        const nrItems = 11;
        const wrapper = loadRelatedItems();
        await checkRelatedItems(nrItems, wrapper);
    });

    it("should display related items according to the project ID and task ID from the props", async () => {
        const nrItems = 11;
        const wrapper = loadRelatedItems({ projectId: PROJECT_ID, taskId: TASK_ID }, `${SERVE_PATH}`);
        await checkRelatedItems(nrItems, wrapper);
    });

    it("should reload the related items when changing the project or task", async () => {
        const nrItems = 11;
        const wrapper = loadRelatedItems();
        await checkRelatedItems(nrItems, wrapper);
        const otherTask = "otherTask";
        history.push(workspacePath(`/projects/${PROJECT_ID}/task/${otherTask}`));
        await waitFor(() => {
            checkRequestMade(relatedItemsUrl(otherTask));
        });
    });

    const relatedItemsUrl = (taskId: string = TASK_ID) =>
        hostPath + `/api/workspace/projects/${PROJECT_ID}/tasks/${taskId}/relatedItems`;

    const PROJECT_ID = "cmem";
    const TASK_ID = "someTask";
    const ITEM_PREFIX = "item";
    const DEFAULT_PAGE_SIZE = 5;

    const loadRelatedItems = (
        props: { projectId?: string; taskId?: string } = {},
        currentUrl: string = `${SERVE_PATH}/projects/${PROJECT_ID}/task/${TASK_ID}`
    ) => {
        history = createBrowserHistory<{}>();
        history.location.pathname = currentUrl;

        return withMount(testWrapper(<RelatedItems {...props} />, history));
    };

    /** Check the initial representation of the related items component. */
    const checkRelatedItems = async function (nrItems: number, wrapper: ReactWrapper<any, any, React.Component>) {
        mockAxios.mockResponseFor(
            { url: relatedItemsUrl() },
            mockedAxiosResponse({ data: RelatedItemsTestHelper.generateRelatedItemsJson(nrItems, ITEM_PREFIX) })
        );

        // Wait for render
        await waitFor(() => {
            expect(wrapper.text()).toContain(`(${nrItems})`);
        });
        // Check items that are displayed in the list
        const shownRelatedItems = findAll(wrapper, "li .eccgui-overviewitem__item");
        expect(shownRelatedItems).toHaveLength(DEFAULT_PAGE_SIZE);
        shownRelatedItems.forEach((elem, idx) => {
            expect(findSingleElement(elem, ".eccgui-link").text()).toBe(`${ITEM_PREFIX + idx} label`);
            expect(findAll(elem, ".eccgui-tag__item").map((tag) => tag.text())).toStrictEqual([
                "testPlugin",
                "Dataset",
            ]);
            // Check item actions
            const itemActions = findSingleElement(elem, ".eccgui-overviewitem__actions").children();
            expect(itemActions).toHaveLength(2);
            // Check detail page link
            const detailPageLink = findSingleElement(itemActions.at(0), "a").get(0);
            expect(detailPageLink.props.href).toBe(workspacePath("/projects/cmem/task/item" + idx));
        });
    };
});
