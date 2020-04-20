import React from "react";
import { ISearchResultsServer } from "@ducks/workspace/typings";
import {
    OverviewItem,
    OverviewItemDepiction,
    OverviewItemDescription,
    OverviewItemLine,
    OverviewItemActions,
    ContextMenu,
    MenuItem,
    MenuDivider,
    Icon,
    IconButton,
    Card,
} from "@wrappers/index";
import { routerOp } from "@ducks/router";
import { useDispatch } from "react-redux";

interface IProps {
    item: ISearchResultsServer;
    searchValue?: string;

    onOpenDeleteModal(item: ISearchResultsServer);

    onOpenDuplicateModal(item: ISearchResultsServer);

    onRowClick?();
}

export default function SearchItem({
    item, searchValue, onOpenDeleteModal, onOpenDuplicateModal, onRowClick
}: IProps) {
    const dispatch = useDispatch();

    const getItemLinkIcons = (label: string) => {
        switch (label) {
            case 'Mapping editor':
                return 'application-mapping';
            case 'Transform evaluation':
                return 'item-evaluation';
            case 'Transform execution':
                return 'item-execution';
            default:
                return null;
        }
    };

    /** Escapes strings to match literally.
     *  taken from https://stackoverflow.com/questions/6318710/javascript-equivalent-of-perls-q-e-or-quotemeta
     */
    const escapeRegexWord = (str: string) => {
        return str.toLowerCase().replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
    };

    /**
     * Returns a highlighted string according to the words of the search query.
     * @param label The string to highlight.
     */
    const getSearchHighlight = (label: string) => {
        if (!searchValue) {
            return label
        }
        const searchStringParts = searchValue.split(RegExp('\\s+'));
        const lowerCaseLabel = label.toLowerCase();
        const validString = searchStringParts.map(escapeRegexWord).join('|');
        const multiWordRegex = RegExp(validString, 'g');
        const result = [];

        let offset = 0;
        // loop through matches and add unmatched and matched parts to result array
        let matchArray = multiWordRegex.exec(lowerCaseLabel);
        while (matchArray !== null) {
            result.push(label.slice(offset, matchArray.index));
            result.push(`<mark>${matchArray[0]}</mark>`);
            offset = multiWordRegex.lastIndex;
            matchArray = multiWordRegex.exec(lowerCaseLabel);
        }
        // Add remaining unmatched string
        result.push(label.slice(offset));
        return result.join('');

    };

    // Remove detailsPath
    const contextMenuItems = item.itemLinks
        .slice(1)
        .map(link =>
            <MenuItem
                key={link.path}
                text={link.label}
                href={link.path}
                icon={getItemLinkIcons(link.label)}
                target={'_blank'}
            />
        );

    const goToDetailsPage = (e) => {
        e.preventDefault();
        const detailsPath = item.itemLinks[0].path;

        dispatch(routerOp.goToPage(detailsPath, true));
    };
console.log(item);
return (
    <Card isOnlyLayout>
        <OverviewItem hasSpacing onClick={onRowClick ? onRowClick : undefined}>
            <OverviewItemDepiction>
                <Icon name={'artefact-' + item.type} large/>
            </OverviewItemDepiction>
            <OverviewItemDescription>
                <OverviewItemLine>
                    <h4 dangerouslySetInnerHTML={{
                        __html: getSearchHighlight(item.label || item.id)
                    }}/>
                </OverviewItemLine>
                {
                    item.description && <OverviewItemLine>
                        <p>{item.description}</p>
                    </OverviewItemLine>
                }
            </OverviewItemDescription>
            <OverviewItemActions>
                <IconButton
                    data-test-id={'open-duplicate-modal'}
                    name='item-clone'
                    text='Clone'
                    onClick={onOpenDuplicateModal}
                />
                {
                    !!item.itemLinks.length &&
                    <IconButton
                        name='item-viewdetails'
                        text='Show details'
                        onClick={goToDetailsPage}
                        href={item.itemLinks[0].path}
                    />
                }
                <ContextMenu togglerText="Show more options">
                    {
                        contextMenuItems.length ? <>
                            <MenuDivider />
                            {contextMenuItems}
                        </> : null
                    }
                    <MenuItem key='delete' icon={'item-remove'} onClick={onOpenDeleteModal} text={'Delete'}/>
                </ContextMenu>
            </OverviewItemActions>
        </OverviewItem>
    </Card>
)
}
