#!/usr/bin/env python3
"""Builds the Tapd In iPhone shortcut and signs it so anyone can install it.

  python3 tools/make-shortcut.py

Writes public/TapdIn.shortcut. The shortcut:
  1. asks once for the person's private Tapd In address (an import question),
  2. downloads the list of people whose texts count from Tapd In,
  3. sends a text only if the sender is on that list,
  4. otherwise, if "suggest new numbers" is on, sends only the number.
Everything not on the list stays on the phone.
"""
import plistlib
import subprocess
import sys
import uuid
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "public" / "TapdIn.shortcut"
OBJ = "￼"  # placeholder character where a variable goes inside text


def uid():
    return str(uuid.uuid4()).upper()


def token_string(text, attachments=None):
    """Text that can contain variables. attachments maps position -> variable."""
    value = {"string": text}
    if attachments:
        value["attachmentsByRange"] = {f"{{{pos}, 1}}": var for pos, var in attachments.items()}
    return {"Value": value, "WFSerializationType": "WFTextTokenString"}


def output_var(output_uuid, name):
    return {"Type": "ActionOutput", "OutputUUID": output_uuid, "OutputName": name}


def input_property(prop):
    """A property of what the automation hands us (the incoming message)."""
    return {
        "Type": "ExtensionInput",
        "Aggrandizements": [{"Type": "WFPropertyVariableAggrandizement", "PropertyName": prop}],
    }


def action(identifier, **params):
    return {"WFWorkflowActionIdentifier": f"is.workflow.actions.{identifier}", "WFWorkflowActionParameters": params}


def form_field(key, value_string):
    return {"WFItemType": 0, "WFKey": token_string(key), "WFValue": value_string}


def post(url_string, fields, out_uuid=None):
    params = {
        "WFURL": url_string,
        "WFHTTPMethod": "POST",
        "WFHTTPBodyType": "Form",
        "WFFormValues": {
            "Value": {"WFDictionaryFieldValueItems": fields},
            "WFSerializationType": "WFDictionaryFieldValue",
        },
        "ShowHeaders": False,
    }
    if out_uuid:
        params["UUID"] = out_uuid
    return action("downloadurl", **params)


def build():
    address_id, list_id, sender_id = uid(), uid(), uid()
    group_outer, group_inner = uid(), uid()
    address = output_var(address_id, "Text")
    sender_text = output_var(sender_id, "Text")
    sender_prop = input_property("Sender")
    content_prop = input_property("Content")

    def url(suffix):
        return token_string(f"{OBJ}{suffix}", {0: address})

    def list_contains(needle):
        return {
            "GroupingIdentifier": None,
            "WFControlFlowMode": 0,
            "WFCondition": "Contains",
            "WFInput": {
                "Type": "Variable",
                "Variable": {"Value": output_var(list_id, "Contents of URL"), "WFSerializationType": "WFTextTokenAttachment"},
            },
            "WFConditionalActionString": needle,
        }

    outer = list_contains(token_string(OBJ, {0: sender_text}))
    outer["GroupingIdentifier"] = group_outer
    inner = list_contains("suggest:on")
    inner["GroupingIdentifier"] = group_inner

    actions = [
        # 0: the person's private address, asked for when they add the shortcut
        action("gettext", WFTextActionText="", UUID=address_id),
        # 1: the list of people whose texts count
        action("downloadurl", WFURL=url("/list"), WFHTTPMethod="GET", ShowHeaders=False, UUID=list_id),
        # 2: who sent this text
        action("gettext", WFTextActionText=token_string(OBJ, {0: sender_prop}), UUID=sender_id),
        # 3: if the sender is on the list, send the text
        action("conditional", **outer),
        post(
            url("?v=2"),
            [
                form_field("from", token_string(OBJ, {0: sender_prop})),
                form_field("text", token_string(OBJ, {0: content_prop})),
            ],
        ),
        action("conditional", GroupingIdentifier=group_outer, WFControlFlowMode=1),
        # otherwise, if suggestions are on, tell Tapd In only the number
        action("conditional", **inner),
        post(url("/new"), [form_field("from", token_string(OBJ, {0: sender_prop}))]),
        action("conditional", GroupingIdentifier=group_inner, WFControlFlowMode=2),
        action("conditional", GroupingIdentifier=group_outer, WFControlFlowMode=2),
    ]

    return {
        "WFWorkflowClientVersion": "1146.1",
        "WFWorkflowMinimumClientVersion": 900,
        "WFWorkflowMinimumClientVersionString": "900",
        "WFWorkflowIcon": {"WFWorkflowIconStartColor": 463140863, "WFWorkflowIconGlyphNumber": 59511},
        "WFWorkflowImportQuestions": [
            {
                "Category": "Parameter",
                "ParameterKey": "WFTextActionText",
                "ActionIndex": 0,
                "Text": "Paste your private Tapd In address (copy it from Tapd In first).",
                "DefaultValue": "",
            }
        ],
        # Accept any kind of input. An automation hands over a message, not plain
        # text, and a shortcut that only accepts text is refused without any error.
        "WFWorkflowInputContentItemClasses": [
            "WFAppContentItem", "WFAppStoreAppContentItem", "WFArticleContentItem", "WFContactContentItem",
            "WFDateContentItem", "WFEmailAddressContentItem", "WFGenericFileContentItem", "WFImageContentItem",
            "WFiTunesProductContentItem", "WFLocationContentItem", "WFDCMapsLinkContentItem", "WFAVAssetContentItem",
            "WFPDFContentItem", "WFPhoneNumberContentItem", "WFRichTextContentItem", "WFSafariWebPageContentItem",
            "WFStringContentItem", "WFURLContentItem",
        ],
        "WFWorkflowTypes": [],
        "WFWorkflowActions": actions,
    }


def build_debug():
    """A diagnostic: shows on the phone how it describes the sender of a text."""
    address_id, sender_id, content_id, reply_id = uid(), uid(), uid(), uid()
    address = output_var(address_id, "Text")
    base = build()
    actions = [
        action("gettext", WFTextActionText="", UUID=address_id),
        action("gettext", WFTextActionText=token_string(OBJ, {0: input_property("Sender")}), UUID=sender_id),
        action("gettext", WFTextActionText=token_string(OBJ, {0: input_property("Content")}), UUID=content_id),
        post(
            token_string(f"{OBJ}/debug", {0: address}),
            [
                form_field("sender", token_string(OBJ, {0: output_var(sender_id, "Text")})),
                form_field("content", token_string(OBJ, {0: output_var(content_id, "Text")})),
            ],
            out_uuid=reply_id,
        ),
        action("showresult", Text=token_string(OBJ, {0: output_var(reply_id, "Contents of URL")})),
    ]
    base["WFWorkflowActions"] = actions
    return base


def sign(plist_data, out):
    raw = out.with_suffix(".unsigned.shortcut")
    raw.write_bytes(plistlib.dumps(plist_data, fmt=plistlib.FMT_BINARY))
    result = subprocess.run(
        ["shortcuts", "sign", "--mode", "anyone", "--input", str(raw), "--output", str(out)],
        capture_output=True,
        text=True,
    )
    raw.unlink(missing_ok=True)
    if result.returncode != 0:
        sys.exit(f"Signing failed: {result.stderr or result.stdout}")
    print(f"Wrote {out} ({out.stat().st_size} bytes)")


def main():
    sign(build(), OUT)
    sign(build_debug(), OUT.with_name("TapdIn-debug.shortcut"))
    return
    raw = OUT.with_suffix(".unsigned.shortcut")
    raw = OUT.with_suffix(".unsigned.shortcut")
    raw.write_bytes(plistlib.dumps(build(), fmt=plistlib.FMT_BINARY))
    result = subprocess.run(
        ["shortcuts", "sign", "--mode", "anyone", "--input", str(raw), "--output", str(OUT)],
        capture_output=True,
        text=True,
    )
    raw.unlink(missing_ok=True)
    if result.returncode != 0:
        sys.exit(f"Signing failed: {result.stderr or result.stdout}")
    print(f"Wrote {OUT} ({OUT.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
