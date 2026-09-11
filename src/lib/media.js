export async function uploadImage(file) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch("https://nostr.build/api/v2/upload/files", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error("Image upload failed");
  }

  const data = await response.json();
  return { url: data.data[0].url, mime: file.type };
}