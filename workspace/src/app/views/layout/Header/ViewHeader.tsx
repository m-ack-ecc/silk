import React, { useState, useEffect } from "react";
import { useDispatch } from "react-redux";
import ReactDOM from "react-dom";
import { Helmet } from "react-helmet";
import {
    BreadcrumbList,
    Button,
    ContextMenu,
    Icon,
    IconButton,
    MenuItem,
    OverflowText,
    OverviewItem,
    OverviewItemActions,
    OverviewItemDepiction,
    OverviewItemDescription,
    OverviewItemLine,
    TitlePage,
} from "@gui-elements/index";
import { IBreadcrumbItemProps } from "@gui-elements/src/components/Breadcrumb/BreadcrumbItem";
import { routerOp } from "@ducks/router";
import { APPLICATION_CORPORATION_NAME, APPLICATION_SUITE_NAME } from "../../../constants/base";
import { withBreadcrumbLabels } from "./withBreadcrumbLabels";

interface IActionBasicProps {
    text: string;
    icon?: string;
    affirmative?: boolean;
    disruptive?: boolean;
    disabled?: boolean;
    "data-test-id"?: string;
}

interface IActionButtonItemProps extends IActionBasicProps {
    actionHandler: (event: React.MouseEvent<HTMLElement>) => void;
    loading?: boolean;
}

interface IActionsMenuActionItemProps extends IActionBasicProps {
    actionHandler: (event: React.MouseEvent<HTMLElement>) => void;
}

interface IActionsMenuParentItemProps extends IActionBasicProps {
    subitems: IActionsMenuActionItemProps[];
}

export type ActionsMenuItem = IActionsMenuActionItemProps | IActionsMenuParentItemProps;

interface IViewHeaderContentProps extends React.HTMLAttributes<HTMLDivElement> {
    type?: string;
    alternateDepiction?: string;
    breadcrumbs?: IBreadcrumbItemProps[];
    autoBreadcrumbs?: boolean;
    pagetitle?: string;
    autoPagetitle?: boolean;
    actionPrimary?: IActionButtonItemProps;
    actionsSecondary?: IActionButtonItemProps[];
    actionsFullMenu?: ActionsMenuItem[];
}

interface IViewHeaderProps extends IViewHeaderContentProps {
    autoBreadcrumbs?: boolean;
}

export const APP_VIEWHEADER_ID = "diapp__viewheader";

// Header element that uses portal function to get rendered in one special place regardless from where it is used
export function ViewHeader({ autoBreadcrumbs = false, ...headerProps }: IViewHeaderProps) {
    const PageHeader = autoBreadcrumbs ? ViewHeaderContentWithBreadCrumbs : ViewHeaderContent;

    return (
        <ViewHeaderPortal>
            <PageHeader {...headerProps} />
        </ViewHeaderPortal>
    );
}

function ViewHeaderPortal({ children }: any) {
    const [portalEnabled, setPortalEnabled] = useState(false);
    const portalTarget = document.getElementById(APP_VIEWHEADER_ID);

    useEffect(() => {
        if (portalTarget && !portalEnabled) {
            portalTarget.innerHTML = "";
            setPortalEnabled(true);
        }
    });

    return portalEnabled ? ReactDOM.createPortal(<>{children}</>, portalTarget) : <></>;
}

function ViewHeaderContent({
    type,
    alternateDepiction,
    breadcrumbs,
    pagetitle,
    autoPagetitle = false,
    actionPrimary,
    actionsSecondary,
    actionsFullMenu,
}: IViewHeaderContentProps) {
    const dispatch = useDispatch();

    const handleBreadcrumbItemClick = (itemUrl, e) => {
        e.preventDefault();
        if (itemUrl) {
            dispatch(routerOp.goToPage(itemUrl, {}));
        }
    };

    const generatedPagetitle =
        autoPagetitle && breadcrumbs && breadcrumbs.length > 0
            ? breadcrumbs[breadcrumbs.length - 1].text.toString()
            : "";

    const renderMenuItems = (items) => {
        return items.map((item, index) => {
            const { text, icon, actionHandler, disabled, subitems, ...otherProps } = item;
            return subitems && subitems.length > 0 ? (
                <MenuItem
                    {...otherProps}
                    key={"menuitem_" + index}
                    text={
                        <OverflowText inline>{text}</OverflowText>
                        /* TODO: change this OverflowText later to a multiline=false option on MenuItem, seenms to be a new one*/
                    }
                >
                    {renderMenuItems(subitems)}
                </MenuItem>
            ) : (
                <MenuItem
                    {...otherProps}
                    key={"menuitem_" + index}
                    text={<OverflowText inline>{text}</OverflowText>}
                    onClick={actionHandler}
                    disabled={disabled ? true : false}
                />
            );
        });
    };

    const renderWindowTitle = () => {
        const typeinfo = !!type ? `(${type})` : "";
        const position =
            !!breadcrumbs && breadcrumbs.length > 1
                ? "at " +
                  breadcrumbs
                      .slice(0, breadcrumbs.length - 1)
                      .map((o) => o.text)
                      .join(" / ")
                : "";
        const application = `${APPLICATION_CORPORATION_NAME} ${APPLICATION_SUITE_NAME}`;

        return `${pagetitle || generatedPagetitle} ${typeinfo} ${position} — ${application}`;
    };

    const getDepictionIcons = () => {
        const iconNames = [];
        if (!!type) {
            iconNames.push("artefact-" + type);
        }
        if (!!alternateDepiction) {
            iconNames.push(alternateDepiction);
        }
        return iconNames;
    };

    let iconNames = getDepictionIcons();

    return (
        <>
            <Helmet title={renderWindowTitle()} />
            <OverviewItem>
                {iconNames.length > 0 && (
                    <OverviewItemDepiction>
                        <Icon name={iconNames} large />
                    </OverviewItemDepiction>
                )}
                <OverviewItemDescription>
                    {!!breadcrumbs && (
                        <OverviewItemLine small>
                            <BreadcrumbList items={breadcrumbs} onItemClick={handleBreadcrumbItemClick} />
                        </OverviewItemLine>
                    )}
                    {(!!pagetitle || !!generatedPagetitle) && (
                        <OverviewItemLine large>
                            <TitlePage>
                                <h1>
                                    <OverflowText>{pagetitle || generatedPagetitle}</OverflowText>
                                </h1>
                            </TitlePage>
                        </OverviewItemLine>
                    )}
                </OverviewItemDescription>
                <OverviewItemActions>
                    {actionPrimary && (
                        <Button
                            icon={actionPrimary.icon}
                            text={actionPrimary.text}
                            key={actionPrimary.text}
                            affirmative={actionPrimary.affirmative ? true : false}
                            disruptive={actionPrimary.disruptive ? true : false}
                            disabled={actionPrimary.disabled ? true : false}
                            outlined={true}
                            onClick={actionPrimary.actionHandler}
                            data-test-id={!!actionPrimary["data-test-id"] ? actionPrimary["data-test-id"] : false}
                        />
                    )}
                    {actionsSecondary &&
                        actionsSecondary.length > 0 &&
                        actionsSecondary.map((actionItem) => {
                            const {
                                icon,
                                text,
                                affirmative,
                                disruptive,
                                disabled,
                                actionHandler,
                                ...otherProps
                            } = actionItem;
                            return (
                                <IconButton
                                    {...otherProps}
                                    name={icon ? icon : "undefined"}
                                    text={text}
                                    key={text}
                                    affirmative={affirmative ? true : false}
                                    disruptive={disruptive ? true : false}
                                    disabled={disabled ? true : false}
                                    onClick={actionHandler}
                                />
                            );
                        })}
                    {actionsFullMenu && actionsFullMenu.length > 0 && (
                        <ContextMenu>{renderMenuItems(actionsFullMenu)}</ContextMenu>
                    )}
                </OverviewItemActions>
            </OverviewItem>
        </>
    );
}

const ViewHeaderContentWithBreadCrumbs = withBreadcrumbLabels(ViewHeaderContent);

// Custom hook to update single properties of the element
export const usePageHeader = ({ autoBreadcrumbs = false, ...propsHeader }: IViewHeaderProps) => {
    const [type, setType] = useState<string>(propsHeader.type);
    const [pagetitle, setPagetitle] = useState<string>(propsHeader.pagetitle);
    const [breadcrumbs, setBreadcrumbs] = useState(propsHeader.breadcrumbs);
    /*
    const [actionPrimary, setActionPrimary ] = useState<IActionButtonItemProps>(propsHeader.actionPrimary);
    const [actionsSecondary, setActionsSecondary ] = useState<IActionButtonItemProps[]>(propsHeader.actionsSecondary);
    const [actionsFullMenu, setActionsFullMenu ] = useState<ActionsMenuItem[]>(propsHeader.actionsFullMenu);
    */

    const propsBreadcrumbs = autoBreadcrumbs ? { autoBreadcrumbs: true } : { breadcrumbs: breadcrumbs };

    const pageHeader = (
        <ViewHeader
            type={type}
            alternateDepiction={propsHeader.alternateDepiction}
            pagetitle={pagetitle}
            autoPagetitle={propsHeader.autoPagetitle}
            actionPrimary={propsHeader.actionPrimary}
            actionsSecondary={propsHeader.actionsSecondary}
            actionsFullMenu={propsHeader.actionsFullMenu}
            {...propsBreadcrumbs}
        />
    );
    return {
        pageHeader,
        updateType: setType,
        updatePagetitle: setPagetitle,
        updateBreadcrumbs: setBreadcrumbs,
    } as const;
};
