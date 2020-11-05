import React, { useEffect, useState } from "react";
import {
    Button,
    Icon,
    Notification,
    OverviewItem,
    OverviewItemDescription,
    OverviewItemLine,
    SimpleDialog,
} from "@gui-elements/index";
import useHotKey from "../HotKeyHandler/HotKeyHandler";
import { useTranslation } from "react-i18next";
import { recentlyViewedItems } from "@ducks/workspace/requests";
import { IRecentlyViewedItem } from "@ducks/workspace/typings";
import { ErrorResponse } from "../../../services/fetch/responseInterceptor";
import { Loading } from "../Loading/Loading";
import { extractSearchWords } from "../Highlighter/Highlighter";
import { IItemLink } from "@ducks/shared/typings";
import { useDispatch, useSelector } from "react-redux";
import { routerOp } from "@ducks/router";
import { Autocomplete } from "../Autocomplete/Autocomplete";
import { useLocation } from "react-router";
import { commonSel } from "@ducks/common";
import { absolutePageUrl } from "@ducks/router/operations";

export function RecentlyViewedModal() {
    const [isOpen, setIsOpen] = useState(false);
    const [recentItems, setRecentItems] = useState<IRecentlyViewedItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<ErrorResponse | null>(null);
    const { pathname } = useLocation();
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const { hotKeys } = useSelector(commonSel.initialSettingsSelector);
    const loadRecentItems = async () => {
        setError(null);
        try {
            setLoading(true);
            const recentItems = (await recentlyViewedItems()).data;
            if (
                recentItems.length > 1 &&
                recentItems[0].itemLinks.length > 0 &&
                recentItems[0].itemLinks[0].path.endsWith(pathname)
            ) {
                // swap 1. and 2. result if 1. result is the same page we are already on
                [recentItems[0], recentItems[1]] = [recentItems[1], recentItems[0]];
            }
            setRecentItems(recentItems);
        } catch (ex) {
            if (ex.isFetchError && ex.errorResponse) {
                setError(ex.errorResponse);
            } else {
                throw ex;
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen && hotKeys.quickSearch) {
            loadRecentItems();
        }
    }, [isOpen, hotKeys.quickSearch]);

    useHotKey({
        hotkey: hotKeys.quickSearch,
        handler: () => setIsOpen(true),
    });
    const close = () => setIsOpen(false);
    const onChange = (itemLinks: IItemLink[]) => {
        setIsOpen(false);
        if (itemLinks.length > 0) {
            const itemLink = itemLinks[0];
            dispatch(routerOp.goToPage(itemLink.path));
        }
    };
    const itemLabel = (item: IRecentlyViewedItem) => {
        const projectLabel = item.projectLabel ? item.projectLabel : item.projectId;
        const taskLabel = item.taskLabel ? item.taskLabel : item.taskId;
        return taskLabel ? `${taskLabel} (${projectLabel})` : projectLabel;
    };
    // Searches on the results from the initial requests
    const onSearch = (textQuery: string) => {
        const searchWords = extractSearchWords(textQuery);
        const filteredItems = recentItems.filter((item) => {
            const label = itemLabel(item).toLowerCase();
            return searchWords.every((word) => label.includes(word));
        });
        return filteredItems;
    };
    // Auto-completion parameters necessary for auto-completion widget. FIXME: This shouldn't be needed.
    const autoCompletion = {
        allowOnlyAutoCompletedValues: true,
        autoCompleteValueWithLabels: true,
        autoCompletionDependsOnParameters: [],
    };
    // Warning when an error has occurred
    const errorView = () => {
        return (
            <Notification danger>
                <span>
                    {error.title}. {error.detail ? ` Details: ${error.detail}` : ""}
                </span>
            </Notification>
        );
    };
    // Global search action
    const globalSearch: (string) => IRecentlyViewedItem = (query: string) => {
        return {
            projectId: "",
            projectLabel: "",
            itemLinks: [
                { label: "Search workspace", path: absolutePageUrl("?textQuery=" + encodeURIComponent(query)) },
            ],
        };
    };
    const createNewItemRenderer = (query: string, active: boolean) => {
        return (
            <OverviewItem
                key={query}
                densityHigh
                style={active ? { backgroundColor: "#0a67a3", color: "#fff" } : undefined}
            >
                <OverviewItemDescription>
                    <OverviewItemLine>
                        <Icon name={"operation-search"} />
                        <span>{t("RecentlyViewedModal.globalSearch", { query })}</span>
                    </OverviewItemLine>
                </OverviewItemDescription>
            </OverviewItem>
        );
    };
    // The auto-completion of the recently viewed items
    const recentlyViewedAutoCompletion = () => {
        return (
            <Autocomplete<IRecentlyViewedItem, IItemLink[]>
                onSearch={onSearch}
                autoCompletion={autoCompletion}
                itemValueSelector={(value) => value.itemLinks}
                itemLabelRenderer={itemLabel}
                onChange={onChange}
                autoFocus={true}
                itemKey={(item) => (item.taskId ? item.taskId : item.projectId)}
                inputProps={{ placeholder: t("RecentlyViewedModal.placeholder") }}
                createNewItemFromQuery={globalSearch}
                createNewItemRenderer={createNewItemRenderer}
            />
        );
    };
    return (
        <SimpleDialog
            transitionDuration={20}
            onClose={close}
            isOpen={isOpen}
            title={t("RecentlyViewedModal.title")}
            actions={<Button onClick={close}>{t("common.action.close")}</Button>}
        >
            {loading ? <Loading /> : error ? errorView() : recentlyViewedAutoCompletion()}
        </SimpleDialog>
    );
}
