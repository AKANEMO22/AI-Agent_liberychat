using System;
using System.IO;
using System.Runtime.InteropServices;

namespace LocalQwenNative {
    [ComImport]
    [Guid("42f85136-db7e-439c-85f1-e4075d135fc8")]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    public interface IFileDialog {
        [PreserveSig] int Show([In] IntPtr parent);
        void SetFileTypes([In] uint cFileTypes, [In] IntPtr rgFilterSpec);
        void SetFileTypeIndex([In] uint iFileType);
        void GetFileTypeIndex(out uint piFileType);
        void Advise([In] IntPtr pfde, out uint pdwCookie);
        void Unadvise([In] uint dwCookie);
        void SetOptions([In] uint fos);
        void GetOptions(out uint fos);
        void SetDefaultFolder([In] IShellItem psi);
        void SetFolder([In] IShellItem psi);
        void GetFolder(out IShellItem ppsi);
        void GetCurrentSelection(out IShellItem ppsi);
        void SetFileName([In, MarshalAs(UnmanagedType.LPWStr)] string pszName);
        void GetFileName([MarshalAs(UnmanagedType.LPWStr)] out string pszName);
        void SetTitle([In, MarshalAs(UnmanagedType.LPWStr)] string pszTitle);
        void SetOkButtonLabel([In, MarshalAs(UnmanagedType.LPWStr)] string pszText);
        void SetFileNameLabel([In, MarshalAs(UnmanagedType.LPWStr)] string pszLabel);
        void GetResult(out IShellItem ppsi);
        void AddPlace([In] IShellItem psi, int fdap);
        void SetDefaultExtension([In, MarshalAs(UnmanagedType.LPWStr)] string pszDefaultExtension);
        void Close([MarshalAs(UnmanagedType.Error)] int hr);
        void SetClientGuid([In] ref Guid guid);
        void ClearClientData();
        void SetFilter([In] IntPtr pFilter);
    }

    [ComImport]
    [Guid("43826d1e-e718-42ee-bc55-a1e261c37bfe")]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    public interface IShellItem {
        void BindToHandler([In] IntPtr pbc, [In] ref Guid bhid, [In] ref Guid riid, out IntPtr ppv);
        void GetParent(out IShellItem ppsi);
        void GetDisplayName([In] uint sigdnName, [MarshalAs(UnmanagedType.LPWStr)] out string ppszName);
        void GetAttributes([In] uint sfgaoMask, out uint psfgaoAttribs);
        void Compare([In] IShellItem psi, [In] uint hint, out int piOrder);
    }

    [ComImport]
    [Guid("DC1C5A9C-E88A-4dde-A5A1-60F82A20AEF7")]
    [ClassInterface(ClassInterfaceType.None)]
    public class FileOpenDialogRCW {}

    public static class NativeDialogHelper {
        [DllImport("shell32.dll", CharSet = CharSet.Unicode, PreserveSig = false)]
        public static extern void SHCreateItemFromParsingName(
            [MarshalAs(UnmanagedType.LPWStr)] string pszPath,
            IntPtr pbc,
            [MarshalAs(UnmanagedType.LPStruct)] Guid riid,
            out IShellItem ppv);

        [DllImport("user32.dll")]
        public static extern IntPtr GetForegroundWindow();

        public static string ShowModernFolderPicker(string title, string initialDir) {
            try {
                var dialog = (IFileDialog)new FileOpenDialogRCW();
                // FOS_PICKFOLDERS (0x20) | FOS_FORCEFILESYSTEM (0x40) | FOS_NOCHANGEDIR (0x8)
                dialog.SetOptions(0x00000020 | 0x00000040 | 0x00000008);

                if (!string.IsNullOrEmpty(title)) {
                    dialog.SetTitle(title);
                }

                if (!string.IsNullOrEmpty(initialDir) && Directory.Exists(initialDir)) {
                    try {
                        Guid guid = new Guid("43826d1e-e718-42ee-bc55-a1e261c37bfe");
                        IShellItem folderItem;
                        SHCreateItemFromParsingName(initialDir, IntPtr.Zero, guid, out folderItem);
                        if (folderItem != null) {
                            dialog.SetFolder(folderItem);
                        }
                    } catch {}
                }

                IntPtr ownerHwnd = GetForegroundWindow();
                int hr = dialog.Show(ownerHwnd);
                if (hr == 0) { // S_OK
                    IShellItem resultItem;
                    dialog.GetResult(out resultItem);
                    if (resultItem != null) {
                        string path;
                        resultItem.GetDisplayName(0x80058000, out path); // SIGDN_FILESYSPATH
                        return path;
                    }
                }
            } catch (Exception ex) {
                return "ERROR:" + ex.Message;
            }
            return null;
        }

        public static string ShowModernFilePicker(string title, string initialDir) {
            try {
                var dialog = (IFileDialog)new FileOpenDialogRCW();
                // FOS_FORCEFILESYSTEM (0x40) | FOS_FILEMUSTEXIST (0x1000)
                dialog.SetOptions(0x00000040 | 0x00001000);

                if (!string.IsNullOrEmpty(title)) {
                    dialog.SetTitle(title);
                }

                if (!string.IsNullOrEmpty(initialDir)) {
                    string folder = Directory.Exists(initialDir) ? initialDir : Path.GetDirectoryName(initialDir);
                    if (!string.IsNullOrEmpty(folder) && Directory.Exists(folder)) {
                        try {
                            Guid guid = new Guid("43826d1e-e718-42ee-bc55-a1e261c37bfe");
                            IShellItem folderItem;
                            SHCreateItemFromParsingName(folder, IntPtr.Zero, guid, out folderItem);
                            if (folderItem != null) {
                                dialog.SetFolder(folderItem);
                            }
                        } catch {}
                    }
                }

                IntPtr ownerHwnd = GetForegroundWindow();
                int hr = dialog.Show(ownerHwnd);
                if (hr == 0) { // S_OK
                    IShellItem resultItem;
                    dialog.GetResult(out resultItem);
                    if (resultItem != null) {
                        string path;
                        resultItem.GetDisplayName(0x80058000, out path); // SIGDN_FILESYSPATH
                        return path;
                    }
                }
            } catch (Exception ex) {
                return "ERROR:" + ex.Message;
            }
            return null;
        }
    }
}
